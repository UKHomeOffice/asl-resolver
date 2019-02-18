const resolver = require('./base-resolver');
const { pick } = require('lodash');

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
  return resolver({ Model: models.Project, action, data, id }, transaction);
};
