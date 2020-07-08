const resolver = require('./base-resolver');
const jsondiff = require('jsondiffpatch').create({ objectHash: obj => obj.id });
const { get, isUndefined } = require('lodash');
const { getRetrospectiveAssessment } = require('../utils');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { ProjectVersion } = models;
  if (action === 'submit' || action === 'withdraw') {
    const status = action === 'submit' ? 'submitted' : 'withdrawn';
    return ProjectVersion.query(transaction).patchAndFetchById(id, { status });
  }

  function getDataWithRa(data) {
    const ra = getRetrospectiveAssessment(data);
    return {
      ...data,
      retrospectiveAssessment: ra.required || ra.condition,
      retrospectiveAssessmentRequired: ra.required
    };
  }

  const updateVersion = () => {
    if (action === 'update') {
      const dataWithRa = getDataWithRa(data);
      return resolver({ Model: ProjectVersion, action, data, id }, transaction);
    }

    return ProjectVersion.query(transaction).findById(id)
      .then(version => {
        version.data = version.data || {};
        version.data.protocols = version.data.protocols || [];
        try {
          const newData = jsondiff.patch(version.data, data.patch);
          const dataWithRa = getDataWithRa(newData);

          return version.$query(transaction).patchAndFetch({ data: dataWithRa });
        } catch (e) {
          e.patch = JSON.stringify(data.patch);
          throw e;
        }
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
