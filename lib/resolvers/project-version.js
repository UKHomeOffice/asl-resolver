const resolver = require('./base-resolver');
const { applyChange } = require('deep-diff');
const { cloneDeep, castArray } = require('lodash');

const applyPatches = (source, patches) => {
  const patched = cloneDeep(source);
  castArray(patches).forEach(p => {
    applyChange(patched, p);
  });
  return patched;
};

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { ProjectVersion } = models;
  if (action === 'submit' || action === 'withdraw') {
    const status = action === 'submit' ? 'submitted' : 'withdrawn';
    return ProjectVersion.query(transaction).patchAndFetchById(id, { status });
  }

  const updateVersion = () => {
    return action === 'update'
      ? resolver({ Model: ProjectVersion, action, data, id }, transaction)
      : ProjectVersion.query(transaction).findById(id)
        .then(version => {
          const newData = applyPatches(version.data, data.patch);
          return version.$query(transaction).patchAndFetch({ data: newData });
        });
  };

  if (action === 'update' || action === 'patch') {
    return updateVersion()
      .then(version => {
        const { Project } = models;
        return Project.query(transaction).findById(version.projectId)
          .then(project => {
            if (project.status === 'inactive') {
              return project.$query(transaction).patchAndFetch({ title: version.data.title });
            }
          })
          .then(() => version);
      });
  }
  return resolver({ Model: ProjectVersion, action, data, id }, transaction);
};
