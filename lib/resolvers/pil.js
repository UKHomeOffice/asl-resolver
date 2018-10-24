const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { PIL } = models;

  if (data) {
    data = pick(data, Object.keys(PIL.jsonSchema.properties));
  }

  if (action === 'create') {
    return PIL.query()
      .insert(data)
      .returning('*');
  }

  if (action === 'update') {
    return PIL.query()
      .patchAndFetchById(id, data);
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => PIL.query().findById(id).delete())
      .then(() => PIL.queryWithDeleted().findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
