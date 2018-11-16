const { pick } = require('lodash');

module.exports = ({ Model, action, data, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  if (data) {
    data = pick(data, Object.keys(Model.jsonSchema.properties));
  }

  if (action === 'create') {
    return Model.query(transaction)
      .insert(data)
      .returning('*');
  }

  if (action === 'update') {
    return Model.query(transaction)
      .patchAndFetchById(id, data);
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => Model.query(transaction).findById(id).delete())
      .then(() => Model.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
