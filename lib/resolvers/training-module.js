const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { TrainingModule } = models;

  if (data) {
    data.forEach(element => {
      element = pick(element, Object.keys(TrainingModule.jsonSchema.properties));
    });
  }

  if (action === 'create') {
    return TrainingModule.query()
      .insert(data);
  }

  if (action === 'update') {
    return TrainingModule.query()
      .findById(id)
      .patch(data);
  }

  if (action === 'delete') {
    return TrainingModule.query()
      .findById(id)
      .delete();
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
