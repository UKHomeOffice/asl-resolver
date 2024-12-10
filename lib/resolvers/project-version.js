const isUUID = require('uuid-validate');
const sha = require('sha.js');
const resolver = require('./base-resolver');
const jsondiff = require('jsondiffpatch').create({
  objectHash: obj => {
    return obj.id || sha('sha256').update(obj).digest('hex');
  }
});
const { get, isUndefined } = require('lodash');
const { retrospectiveAssessment, extractReminders } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { ProjectVersion, Project, Reminder } = models;

  function updateAdditionalAvailability(version) {
    const { ProjectEstablishment } = models;
    const additionalEstablishmentsSelected = get(version, 'data.other-establishments', false);

    const establishments = additionalEstablishmentsSelected
      ? get(version, 'data.establishments', [])
        .filter(e => !e.deleted)
        .filter(e => e['establishment-id'])
        .map(e => e['establishment-id'])
      : [];

    function addRelations(estIds) {
      if (!estIds.length) {
        return Promise.resolve();
      }

      return ProjectEstablishment.query(transaction).insert(estIds.map(establishmentId => {
        return {
          projectId: version.projectId,
          establishmentId
        };
      }));
    }

    function removeRelations(projectEstablishments) {
      if (!projectEstablishments.length) {
        return Promise.resolve();
      }

      return Promise.all(projectEstablishments.map(pe => {
        if (pe.status === 'draft') {
          return pe.$query(transaction).delete();
        }
        return Promise.resolve();
      }));
    }

    return ProjectEstablishment.query(transaction).where({ projectId: version.projectId })
      .then(projectEstablishments => {
        const existingEstablishments = projectEstablishments.map(pe => pe.establishmentId);
        const establishmentIdsToAdd = establishments.filter(e => !existingEstablishments.includes(e));
        const relationsToRemove = projectEstablishments.filter(pe => !establishments.includes(pe.establishmentId));

        return Promise.all([
          addRelations(establishmentIdsToAdd),
          removeRelations(relationsToRemove)
        ])
          .then(() => version);
      });
  }

  if (action === 'submit' || action === 'withdraw') {
    const status = action === 'submit' ? 'submitted' : 'withdrawn';
    return ProjectVersion.query(transaction).patchAndFetchById(id, { status });
  }

  if (action === 'updateConditions') {
    const version = await ProjectVersion.query(transaction).findById(id).withGraphFetched('project');
    const existingReminders = await Reminder.query(transaction).where({ modelId: version.projectId });

    const { protocolId, retrospectiveAssessment } = data;
    const { conditions, reminders } = extractReminders(version, data.conditions);

    existingReminders
      // protocol conditions are only sent individually, so filter to specific protocol condiition
      // project level conditions are sent as a group and don't use uuids
      .filter(r => protocolId ? r.conditionKey === conditions[0].key : !isUUID(r.conditionKey))
      .forEach(existingReminder => {
        if (!reminders.find(r => r.id === existingReminder.id)) {
          reminders.push({ ...existingReminder, deleted: (new Date()).toISOString() });
        }
      });

    await Promise.all(
      // reminders have a deleted prop set where necessary, so upsert will handle deletions as well
      reminders.map(reminder => Reminder.upsert(reminder, undefined, transaction))
    );

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

    await version.$query(transaction).patchAndFetch({ data: versionData });
    return { id };
  }

  if (action === 'patch') {
    const version = await ProjectVersion.query(transaction).findById(id);
    const project = await Project.query(transaction).findById(version.projectId);

    return Promise.resolve()
      .then(() => {
        version.data = version.data || {};
        version.data.protocols = version.data.protocols || [];
        try {
          const newData = jsondiff.patch(version.data, data.patch);

          const patch = {
            data: {
              ...newData,
              retrospectiveAssessment: retrospectiveAssessment.addedByAsru(newData)
            }
          };

          if (project.status === 'inactive') {
            patch.raCompulsory = retrospectiveAssessment.isRequired(newData);
          } else {
            patch.raCompulsory = version.raCompulsory || retrospectiveAssessment.isRequired(newData);
          }

          return version.$query(transaction).patchAndFetch(patch);
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
