const { pick, get, omit, isEqual, isInteger } = require('lodash');
const moment = require('moment');
const resolver = require('./base-resolver');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id, meta = {} }, transaction) => {
  const { Project, ProjectVersion, Profile } = models;

  const fork = preserveStatus => {
    let fields = ['data', 'projectId', 'asruVersion'];
    if (preserveStatus) {
      fields = [...fields, 'status'];
    }
    return Promise.resolve()
      .then(() => {
        return ProjectVersion.query(transaction)
          .where({ projectId: id })
          .orderBy('createdAt', 'desc')
          .first();
      })
      .then(version => {
        if (version.status === 'granted') {
          return Promise.resolve()
            .then(() => getProfile(meta.changedBy))
            .then(profile => {
              return {
                ...version,
                asruVersion: !!(profile && profile.asruUser)
              };
            });
        }
        return version;
      })
      .then(version => ProjectVersion.query(transaction).insertAndFetch(pick(version, fields)));
  };

  const getProfile = (id) => {
    if (!id) return Promise.resolve();
    return Profile.query(transaction).findById(id);
  };

  const getMostRecentVersion = (status) => {
    const query = status ? { projectId: id, status } : { projectId: id };
    return ProjectVersion.query(transaction)
      .where(query)
      .orderBy('createdAt', 'desc')
      .first();
  };

  const deleteProject = () => {
    return Promise.resolve()
      .then(() => Project.query(transaction).findById(id))
      .then(project => {
        if (project.status === 'active') {
          throw new Error('Cannot delete active project');
        }
      })
      .then(() => ProjectVersion.query(transaction).delete().where({ projectId: id }))
      .then(() => Project.query(transaction).findById(id).delete())
      .then(() => Project.queryWithDeleted(transaction).findById(id));
  };

  const version = get(data, 'version', {});

  if (data) {
    data = pick(data, Object.keys(Project.jsonSchema.properties));
  }

  if (action === 'create') {
    const isLegacyStub = get(data, 'isLegacyStub', false);

    if (isLegacyStub) {
      const expiryDate = moment(data.issueDate).add({
        years: parseInt(version.data.duration.years, 0) || 5,
        months: parseInt(version.data.duration.months, 0) || 0
      }).toISOString();

      const projectStub = {
        ...data,
        migratedId: 'legacy-conversion', // this project is being converted from an old paper record
        status: 'active',
        expiryDate,
        schemaVersion: 0,
        isLegacyStub: true,
        version: {
          ...version,
          asruVersion: true,
          status: 'granted',
          data: {
            ...version.data,
            isLegacyStub: true // initial stub version will always have isLegacyStub: true
          }
        }
      };

      return Project.query(transaction).insertGraphAndFetch(projectStub);
    }

    const title = get(version, 'data.title', null);
    return Project.query(transaction).insertGraphAndFetch({ ...data, version, title });
  }

  if (action === 'convert') {
    let versionToGrant = await getMostRecentVersion();
    const project = await Project.query(transaction).findById(id);

    if (versionToGrant.status === 'granted') {
      return project;
    }

    const data = versionToGrant.data;
    data.protocols = (data.protocols || []).filter(p => !p.deleted);
    delete data.isLegacyStub; // after conversion, all future versions do not have the isLegacyStub prop
    versionToGrant = await versionToGrant.$query(transaction).patchAndFetch({ status: 'granted', data });

    const projectPatch = {
      isLegacyStub: false, // after conversion, the project itself is no-longer a stub
      title: versionToGrant.data.title
    };

    return project.$query(transaction).patchAndFetch(projectPatch);
  }

  if (action === 'fork') {
    return fork();
  }

  if (action === 'submit-draft') {
    return getMostRecentVersion('draft')
      .then(version => {
        if (version) {
          return version.$query(transaction).patchAndFetch({ status: 'submitted' });
        }
      })
      .then(() => Project.query(transaction).findById(id));
  }

  if (action === 'grant') {
    let versionToGrant = await getMostRecentVersion();
    const grantedVersion = await getMostRecentVersion('granted');
    const project = await Project.query(transaction).findById(id);

    if (versionToGrant.status === 'granted') {
      return project;
    }
    if (versionToGrant.status !== 'submitted') {
      throw new Error('Cannot grant unsubmitted version');
    }

    const data = versionToGrant.data;
    data.protocols = (data.protocols || []).filter(p => !p.deleted);
    versionToGrant = await versionToGrant.$query(transaction).patchAndFetch({ status: 'granted', data });

    const licenceNumber = await generateLicenceNumber(Project, transaction, 'project', project.schemaVersion);

    const start = project.issueDate ? moment(project.issueDate) : moment();
    const issueDate = start.toISOString();
    const patch = {
      status: 'active',
      issueDate,
      title: versionToGrant.data.title,
      licenceNumber: project.licenceNumber || licenceNumber
    };

    if (grantedVersion) {
      patch.amendedDate = moment().toISOString();
    }

    const currentDuration = get(grantedVersion, 'data.duration');
    const newDuration = get(versionToGrant, 'data.duration');

    if (!isEqual(currentDuration, newDuration) || newDuration === undefined) {
      let months = get(newDuration, 'months');
      let years = get(newDuration, 'years');
      months = isInteger(months) ? months : 0;
      years = isInteger(years) ? years : 5;

      if (months > 12) {
        months = 0;
      }

      if (years >= 5 || (!months && !years)) {
        years = 5;
        months = 0;
      }
      patch.expiryDate = start.add({ months, years }).toISOString();
    }

    return project.$query(transaction).patchAndFetch(patch);
  }

  if (action === 'update') {
    const patchVersionData = version => version.$query(transaction).patchAndFetch({ data: { ...version.data, ...omit(meta, 'comments') } });
    return Project.query(transaction).findById(id)
      .then(project => {
        if (project.status === 'active') {
          return fork(true)
            .then(patchVersionData);
        }
        if (project.status === 'inactive') {
          return getMostRecentVersion('draft')
            .then(patchVersionData);
        }
      })
      .then(() => Project.query(transaction).patchAndFetchById(id, data));
  }

  if (action === 'update-issue-date') {
    const project = await Project.query(transaction).findById(id);

    if (project.status !== 'active') {
      throw new Error('Cannot update issue date for non-active project');
    }

    const grantedVersion = await getMostRecentVersion('granted');
    const duration = get(grantedVersion, 'data.duration');

    const patch = {
      issueDate: moment(data.issueDate).toISOString(),
      expiryDate: moment(data.issueDate).add(duration).toISOString()
    };

    return project.$query(transaction).patchAndFetch(patch);
  }

  if (action === 'delete') {
    return deleteProject();
  }

  if (action === 'delete-amendments') {
    return Promise.resolve()
      .then(() => Project.query(transaction).findById(id))
      .then(project => {
        // project is a draft, soft delete including all versions
        if (project.status === 'inactive') {
          return deleteProject();
        }
        // delete all versions since the most recent granted
        return Promise.resolve()
          .then(() => ProjectVersion.query(transaction).where({ projectId: id }).orderBy('createdAt', 'desc'))
          .then(versions => {
            const granted = versions.find(v => v.status === 'granted');
            return versions.filter(v => v.status !== 'granted' && v.createdAt > granted.createdAt);
          })
          .then(recentDraftVersions => {
            return ProjectVersion.query(transaction)
              .delete()
              .whereIn('id', recentDraftVersions.map(v => v.id));
          })
          .then(() => Project.query(transaction).findById(id));
      });
  }

  if (action === 'transfer') {
    let versionToTransfer = await getMostRecentVersion();
    const project = await Project.query(transaction).findById(id);
    if (versionToTransfer.status !== 'submitted') {
      throw new Error('Cannot transfer unsubmitted version');
    }
    const newProject = await Project.query(transaction).insert({
      ...omit(project, 'id'),
      establishmentId: data.establishmentId
    });
    await ProjectVersion.query(transaction).insert({
      ...omit(versionToTransfer, 'id'),
      projectId: newProject.id,
      status: 'granted',
      data: omit(versionToTransfer.data, 'transferToEstablishment')
    });
    await Project.query(transaction).findById(id).patch({ status: 'transferred' });
    return newProject;
  }

  if (action === 'withdraw') {
    return ProjectVersion.query(transaction)
      .where({ projectId: id, status: 'submitted' })
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => {
        return version.$query(transaction).patchAndFetch({ status: 'withdrawn' });
      })
      .then(() => Project.query(transaction).findById(id));
  }

  if (action === 'revoke') {
    return Project.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.Project, action, data, id }, transaction);
};
