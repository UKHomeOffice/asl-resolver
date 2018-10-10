const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { TrainingModule } = models;

  if (data) {
    data = pick(data, Object.keys(TrainingModule.jsonSchema.properties));
  }

  if (action === 'create') {
    return TrainingModule.query()
      .insert(data)
      .returning('*');
  }

  if (action === 'update') {
    return TrainingModule.query()
      .patchAndFetchById(id, data);
  }

  if (action === 'delete') {
    return TrainingModule.query()
      .findById(id)
      .delete()
      .returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
