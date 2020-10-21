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

  function updateAdditionalAvailability(version) {
    const { ProjectEstablishment } = models;
    const establishments = get(version, 'data.establishments', [])
      .filter(e => e['establishment-id'])
      .map(e => e['establishment-id']);

    function addRelations(estIds) {
      if (!estIds.length) {
        return Promise.resolve();
      }

      return ProjectEstablishment.query(transaction).insert(estIds.map(establishmentId => {
        return {
          projectId: version.projectId,
          establishmentId
        }
      }));
    }

    function removeRelations(projectEstablishments) {
      if (!projectEstablishments.length) {
        return Promise.resolve();
      }

      return Promise.all(projectEstablishments.map(pe => {
        if (pe.status === 'draft') {
          return pe.$query(transaction)
            .hardDelete()
        }
        else if (pe.status === 'active') {
          return ProjectVersion.query(transaction)
            .where({ status: 'granted', projectId: pe.projectId })
            .orderBy('createdAt', 'desc')
            .select('id')
            .first()
            .then(latestGrantedVersion => {
              return pe.$query(transaction)
                .patch({ status: 'removed', versionId: latestGrantedVersion.id })
            });
        }
      }));
    }

    return ProjectEstablishment.query(transaction).where({ projectId: version.projectId })
      .then(projectEstablishments => {
        const existingEstablishments = projectEstablishments.map(pe => pe.establishmentId);
        const establishmentIdsToAdd = establishments.filter(e => !existingEstablishments.includes(e));
        const establishmentsToRemove = projectEstablishments.filter(pe => !establishments.includes(pe.establishmentId));

        return Promise.all([
          addRelations(establishmentIdsToAdd),
          removeRelations(establishmentsToRemove)
        ])
          .then(() => version);
      });
  }

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
      .then(updateAdditionalAvailability)
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
