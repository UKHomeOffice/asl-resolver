const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { ProjectVersion } = models;
  if (action === 'submit' || action === 'withdraw') {
    const status = action === 'submit' ? 'submitted' : 'withdrawn';
    return ProjectVersion.query(transaction).patchAndFetchById(id, { status });
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
