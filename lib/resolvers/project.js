const resolver = require('./base-resolver');
const { pick, get } = require('lodash');
const { generateLicenceNumber } = require('../utils');
const moment = require('moment');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { Project, ProjectVersion } = models;

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
    return ProjectVersion.query(transaction)
      .where({ projectId: id })
      .whereNot({ status: 'withdrawn' })
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => ProjectVersion.query(transaction).insertAndFetch(pick(version, 'data', 'projectId')));
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

        return Project.query(transaction).findById(id)
          .then(project => {
            const startDate = project.issueDate ? moment(project.issueDate) : moment();
            const expiryDate = startDate.add({ months, years }).toISOString();
            return project.$query(transaction).patchAndFetch({
              status: 'active',
              issueDate: project.issueDate || moment().toISOString(),
              expiryDate,
              title: version.data.title,
              licenceNumber: project.licenceNumber || generateLicenceNumber()
            });
          });
      });
  }

  return resolver({ Model: models.Project, action, data, id }, transaction);
};
