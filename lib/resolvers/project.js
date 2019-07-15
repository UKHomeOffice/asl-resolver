const resolver = require('./base-resolver');
const { pick, get, omit } = require('lodash');
const { generateLicenceNumber } = require('../utils');
const moment = require('moment');

module.exports = ({ models }) => ({ action, data, id, meta }, transaction) => {
  const { Project, ProjectVersion } = models;

  const fork = preserveStatus => {
    let fields = ['data', 'projectId'];
    if (preserveStatus) {
      fields = [...fields, 'status'];
    }
    return ProjectVersion.query(transaction)
      .where({ projectId: id })
      .whereNot({ status: 'withdrawn' })
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => ProjectVersion.query(transaction).insertAndFetch(pick(version, fields)));
  };

  if (data) {
    data = pick(data, Object.keys(Project.jsonSchema.properties));
  }

  if (action === 'create') {
    return Project.query(transaction).insertAndFetch(data)
      .then(project => {
        return Promise.resolve()
          .then(() => ProjectVersion.query(transaction).insert({ projectId: project.id }))
          .then(() => project);
      });
  }

  if (action === 'fork') {
    return fork();
  }

  if (action === 'submit-draft') {
    return ProjectVersion.query(transaction)
      .where({ projectId: id, status: 'draft' })
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => version.$query(transaction).patchAndFetch({ status: 'submitted' }))
      .then(() => Project.query(transaction).findById(id));
  }

  if (action === 'grant') {
    return ProjectVersion.query(transaction)
      .where({ projectId: id, status: 'submitted' })
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => version.$query(transaction).patchAndFetch({ status: 'granted' }))
      .then(version => {
        let months = get(version, 'data.duration.months', 0);
        let years = get(version, 'data.duration.years', 5);
        if (months > 12) {
          months = 0;
        }
        if (years >= 5) {
          years = 5;
          months = 0;
        }

        const project = Project.query(transaction).findById(id).then(project => project);
        return Promise.all([project, generateLicenceNumber(Project, transaction, 'project', project.schemaVersion)])
          .then(([project, licenceNumber]) => {
            const start = project.issueDate ? moment(project.issueDate) : moment();
            const issueDate = start.toISOString();
            const expiryDate = start.add({ months, years }).toISOString();
            return project.$query(transaction).patchAndFetch({
              status: 'active',
              issueDate,
              expiryDate,
              title: version.data.title,
              licenceNumber: project.licenceNumber || licenceNumber
            });
          });
      });
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
          return ProjectVersion.query(transaction)
            .where({ projectId: id, status: 'draft' })
            .orderBy('createdAt', 'desc')
            .first()
            .then(patchVersionData);
        }
      })
      .then(() => Project.query(transaction).patchAndFetchById(id, data));
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => ProjectVersion.query(transaction).delete().where({ projectId: id }))
      .then(() => Project.query(transaction).findById(id).delete())
      .then(() => Project.queryWithDeleted(transaction).findById(id));
  }

  if (action === 'delete-amendments') {
    return ProjectVersion.query(transaction).where({ projectId: id }).orderBy('createdAt', 'desc')
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
  }

  return resolver({ Model: models.Project, action, data, id }, transaction);
};
