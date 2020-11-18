const { pick, get, omit, isEqual, isInteger } = require('lodash');
const moment = require('moment');
const resolver = require('./base-resolver');
const { generateLicenceNumber, normaliseProjectVersion } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id, meta = {} }, transaction) => {
  const { Project, ProjectVersion, ProjectEstablishment, Profile, Certificate } = models;

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
        if (project.status === 'active' && !project.isLegacyStub) {
          throw new Error('Cannot delete active project');
        }
      })
      .then(() => ProjectVersion.query(transaction).delete().where({ projectId: id }))
      .then(() => Project.query(transaction).findById(id).delete())
      .then(() => Project.queryWithDeleted(transaction).findById(id));
  };

  const calculateExpiryDate = (issueDate, duration) => {
    issueDate = issueDate ? moment(issueDate) : moment();
    const defaultDuration = { years: 5, months: 0 };

    duration.years = parseInt(get(duration, 'years'), 10);
    duration.months = parseInt(get(duration, 'months'), 10);

    duration.years = isInteger(duration.years) && duration.years <= 5 ? duration.years : defaultDuration.years;
    duration.months = isInteger(duration.months) && duration.years < 5 && duration.months <= 11 ? duration.months : defaultDuration.months;

    return issueDate.add(duration).toISOString();
  };

  function getRaDate(version, startDate) {
    if (version.raCompulsory || version.data.retrospectiveAssessment) {
      return moment(startDate).add(6, 'months').toISOString();
    }
    return null;
  }

  function setAdditionalAvailability(version) {
    const additionalEstablishmentsSelected = get(version, 'data.other-establishments', false);
    const establishments = additionalEstablishmentsSelected
      ? get(version, 'data.establishments', [])
        .filter(e => e['establishment-id'])
        .map(e => e['establishment-id'])
      : [];

    return Promise.resolve()
      .then(() => getMostRecentVersion('granted'))
      .then(latestGrantedVersion => {
        if (latestGrantedVersion) {
          return ProjectEstablishment.query(transaction)
            .where({ projectId: id, status: 'active' })
            .whereNotIn('establishmentId', establishments)
            .patch({ status: 'removed', versionId: latestGrantedVersion.id, revokedDate: moment().toISOString() });
        }
      })
      .then(() => ProjectEstablishment.query(transaction)
        .where({ projectId: id })
        .whereIn('status', ['draft', 'removed'])
        .whereIn('establishmentId', establishments)
        .patch({ status: 'active', versionId: null, revokedDate: null, issueDate: moment().toISOString() })
      );
  }

  const version = get(data, 'version', {});

  if (data) {
    data = pick(data, Object.keys(Project.jsonSchema.properties));
  }

  if (action === 'create') {
    const isLegacyStub = get(data, 'isLegacyStub', false);

    if (isLegacyStub) {
      const expiryDate = calculateExpiryDate(data.issueDate, version.data.duration);

      const projectStub = {
        ...data,
        migratedId: 'legacy-conversion', // this project is being converted from an old paper record
        status: moment(expiryDate).isBefore(moment()) ? 'expired' : 'active',
        expiryDate,
        schemaVersion: 0,
        isLegacyStub: true,
        version: {
          ...version,
          asruVersion: true,
          status: 'granted',
          data: {
            ...version.data,
            protocols: [],
            isLegacyStub: true // initial stub version will always have isLegacyStub: true
          }
        }
      };

      return Project.query(transaction).insertGraphAndFetch(projectStub);
    }

    const title = get(version, 'data.title', null);
    return Project.query(transaction).insertGraphAndFetch({
      ...data,
      title,
      version: normaliseProjectVersion(version)
    });
  }

  if (action === 'convert') {
    let versionToGrant = await getMostRecentVersion('draft');
    const project = await Project.query(transaction).findById(id);

    if (!project.isLegacyStub || !versionToGrant.data.isLegacyStub) {
      throw new Error('Cannot convert non-legacy-stub projects');
    }

    const data = versionToGrant.data;
    data.protocols = (data.protocols || []).filter(p => !p.deleted);
    delete data.isLegacyStub; // after conversion, all future versions do not have the isLegacyStub prop
    versionToGrant = await versionToGrant.$query(transaction).patchAndFetch({ status: 'granted', data });

    const projectPatch = {
      isLegacyStub: false, // after conversion, the project itself is no-longer a stub
      title: versionToGrant.data.title,
      expiryDate: calculateExpiryDate(project.issueDate, versionToGrant.data.duration)
    };

    return project.$query(transaction).patchAndFetch(projectPatch);
  }

  if (action === 'fork') {
    return fork();
  }

  if (action === 'submit-draft') {
    const version = await getMostRecentVersion('draft');
    const project = await Project.query(transaction).findById(id);

    if (!version) {
      return project;
    }

    const training = await Certificate.query(transaction).where({ profileId: project.licenceHolderId });
    await version.$query(transaction).patchAndFetch({ status: 'submitted', data: { ...version.data, training } });
    return project;
  }

  function removeDeletedConditions(item = {}) {
    item.conditions = (item.conditions || []).filter(c => !c.deleted);
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

    removeDeletedConditions(data);
    data.protocols.forEach(removeDeletedConditions);

    await setAdditionalAvailability(versionToGrant);

    versionToGrant = await versionToGrant.$query(transaction).patchAndFetch({ status: 'granted', data });

    const licenceNumber = await generateLicenceNumber({ model: Project, transaction, type: 'project', version: project.schemaVersion });

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

    patch.raDate = getRaDate(versionToGrant, patch.expiryDate || project.expiryDate);

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

  if (action === 'update-licence-number') {
    const project = await Project.query(transaction).findById(id);

    if (!project.isLegacyStub) {
      throw new Error('Can only update the licence number for legacy stubs');
    }

    const patch = {
      licenceNumber: data.licenceNumber
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
    if (versionToTransfer.status !== 'submitted') {
      throw new Error('Cannot transfer unsubmitted version');
    }

    const project = await Project.query(transaction).findById(id);
    const transferDate = moment().toISOString();

    const newProject = await Project.query(transaction).insert({
      ...omit(project, 'id'),
      establishmentId: data.establishmentId,
      previousEstablishmentId: project.establishmentId,
      previousProjectId: id,
      transferredInDate: transferDate
    });

    await ProjectVersion.query(transaction).insert({
      ...omit(versionToTransfer, 'id'),
      projectId: newProject.id,
      status: 'granted',
      data: omit(versionToTransfer.data, 'transferToEstablishment')
    });

    await project.$query(transaction).patch({
      status: 'transferred',
      transferProjectId: newProject.id,
      transferEstablishmentId: data.establishmentId,
      transferredOutDate: transferDate
    });
    return newProject;
  }

  if (action === 'transfer-draft') {
    const project = await Project.query(transaction).findById(id);

    if (project.status !== 'inactive') {
      throw new Error('Cannot transfer non-draft projects');
    }

    const profile = await Profile.query(transaction).findById(project.licenceHolderId).withGraphFetched('establishments');

    if (!profile.establishments.find(e => e.id === data.establishmentId)) {
      throw new Error('Cannot transfer to an establishment the licence holder is not associated with');
    }

    return Project.query(transaction).patchAndFetchById(id, { establishmentId: data.establishmentId });
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
    const latestVersion = await getMostRecentVersion('granted');
    const revocationDate = new Date().toISOString();

    const patch = {
      status: 'revoked',
      revocationDate,
      raDate: getRaDate(latestVersion, revocationDate)
    };

    return Project.query(transaction).patchAndFetchById(id, patch);
  }

  return resolver({ Model: models.Project, action, data, id }, transaction);
};
