const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  return resolver({ Model: models.ProjectVersion, action, data, id }, transaction)
    .then(version => {
      if (action === 'update') {
        return models.Project.query(transaction).patchAndFetchById(version.projectId, { title: version.data.title })
          .then(() => version);
      }
      return version;
    });
};
