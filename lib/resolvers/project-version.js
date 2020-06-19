const resolver = require('./base-resolver');
const jsondiff = require('jsondiffpatch').create({ objectHash: obj => obj.id });
const { get, isUndefined } = require('lodash');

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
          version.data = version.data || {};
          version.data.protocols = version.data.protocols || [];
          const newData = jsondiff.patch(version.data, data.patch);
          return version.$query(transaction).patchAndFetch({ data: newData });
        });
  };

  if (action === 'updateConditions') {
    const { conditions, protocolId, retrospectiveAssessment } = data;
    return ProjectVersion.query().findById(id)
      .then(version => {
        const versionData = version.data;
        if (protocolId) {
          versionData.protocols = versionData.protocols.map(protocol => {
            if (protocol.id === protocolId) {
              return {
                ...protocol,
                conditions
              };
            }
            return protocol;
          });
        } else if (conditions) {
          versionData.conditions = conditions;
        }
        if (!isUndefined(retrospectiveAssessment)) {
          versionData.retrospectiveAssessment = !!retrospectiveAssessment;
        }
        return version.$query().patchAndFetch({ data: versionData });
      });
  }

  if (action === 'update' || action === 'patch') {
    return updateVersion()
      .then(version => {
        const { Project } = models;
        return Project.query(transaction).findById(version.projectId)
          .then(project => {
            if (project.status === 'inactive') {
              const title = get(version, 'data.title');
              return project.$query(transaction).patchAndFetch({ title });
            }
          })
          .then(() => ({ id }));
      });
  }
  return resolver({ Model: ProjectVersion, action, data, id }, transaction);
};
