const resolver = require('./base-resolver');
const { pick, get } = require('lodash');
const { generateLicenceNumber } = require('../utils');
const moment = require('moment');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { Project, ProjectVersion } = models;

  if (data) {
    data = pick(data, Object.keys(Project.jsonSchema.properties));
  }

  const now = moment().toISOString();

  if (action === 'create') {
    return Project.query(transaction).insertAndFetch(data)
      .then(project => {
        return Promise.resolve()
          .then(() => ProjectVersion.query(transaction).insert({ projectId: project.id }))
          .then(() => project);
      });
  }

  if (action === 'grant') {
    return ProjectVersion.query(transaction)
      .where({ projectId: id })
      .whereNull('grantedAt')
      .whereNotNull('submittedAt')
      .orderBy('createdAt', 'desc')
      .first()
      .then(version => version.$query(transaction).patchAndFetch({ grantedAt: now }))
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
        const expiryDate = moment().add({ months, years }).toISOString();
        return Project.query(transaction)
          .patchAndFetchById(id, {
            status: 'active',
            issueDate: now,
            expiryDate,
            licenceNumber: generateLicenceNumber()
          });
      });
  }

  return resolver({ Model: models.Project, action, data, id }, transaction);
};
