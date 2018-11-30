const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data }, transaction) => {

  const { Permission } = models;

  if (data) {
    data = pick(data, Object.keys(Permission.jsonSchema.properties));
  }

  if (action === 'update') {
    return Permission.query(transaction)
      .patch({ role: data.role }).where('profileId', data.profileId).returning('*');
  }

  if (action === 'delete') {
    return Permission.query(transaction).hardDelete().where('profileId', data.profileId).returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
