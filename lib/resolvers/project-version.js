const sha = require('sha.js');
const resolver = require('./base-resolver');
const jsondiff = require('jsondiffpatch').create({
  objectHash: obj => {
    return obj.id || sha('sha256').update(obj).digest('hex');
  }
});
const { get, isUndefined } = require('lodash');
const { retrospectiveAssessment } = require('../utils');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { ProjectVersion } = models;
  if (action === 'submit' || action === 'withdraw') {
    const status = action === 'submit' ? 'submitted' : 'withdrawn';
    return ProjectVersion.query(transaction).patchAndFetchById(id, { status });
  }

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

  if (action === 'patch') {
    return Promise.resolve()
      .then(() => ProjectVersion.query(transaction).findById(id))
      .then(version => {
        version.data = version.data || {};
        version.data.protocols = version.data.protocols || [];
        try {
          const newData = jsondiff.patch(version.data, data.patch);

          return version.$query(transaction).patchAndFetch({
            data: {
              ...newData,
              retrospectiveAssessment: retrospectiveAssessment.addedByAsru(newData)
            },
            raCompulsory: retrospectiveAssessment.isRequired(newData)
          });
        } catch (e) {
          e.patch = JSON.stringify(data.patch);
          throw e;
        }
      })
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
