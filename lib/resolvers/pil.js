const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { PIL } = models;

  if (data) {
    data.establishmentId = data.establishment;
    data.profileId = data.profile;
    data = pick(data, Object.keys(PIL.jsonSchema.properties));
  }

  if (action === 'create') {
    return PIL.query()
      .insert(data);
  }

  if (action === 'update') {
    return PIL.query()
      .findById(id)
      .patch(data);
  }

  if (action === 'delete') {
    return PIL.query()
      .findById(id)
      .delete();
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
