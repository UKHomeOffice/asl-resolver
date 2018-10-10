const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  if (!id && action === 'update') {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Profile } = models;

  if (data) {
    data = pick(data, Object.keys(Profile.jsonSchema.properties));
  }

  if (action === 'update') {
    return Profile.query()
      .patchAndFetchById(id, data);
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
