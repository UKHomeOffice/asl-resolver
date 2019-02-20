const resolver = require('./base-resolver');
const moment = require('moment');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  if (action === 'submit') {
    return models.ProjectVersion.query(transaction).patchAndFetchById(id, { submittedAt: moment().toISOString() });
  }
  return resolver({ Model: models.ProjectVersion, action, data, id }, transaction)
    .then(version => {
      if (action === 'update') {
        return models.Project.query(transaction).patchAndFetchById(version.projectId, { title: version.data.title })
          .then(() => version);
      }
      return version;
    });
};
