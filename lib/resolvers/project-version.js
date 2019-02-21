const resolver = require('./base-resolver');
const moment = require('moment');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { ProjectVersion } = models;
  if (action === 'submit') {
    return ProjectVersion.query(transaction).patchAndFetchById(id, { submittedAt: moment().toISOString() });
  }
  return resolver({ Model: ProjectVersion, action, data, id }, transaction)
    .then(version => {
      if (action === 'update') {
        const { Project } = models;
        return Project.query(transaction).findById(version.projectId)
          .then(project => {
            if (project.status === 'inactive') {
              return project.$query(transaction).patchAndFetch({ title: version.data.title });
            }
          })
          .then(() => version);
      }
      return version;
    });
};
