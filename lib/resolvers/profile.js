const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }) => {
  return resolver({ Model: models.Profile, action, data, id })
    .then(result => {
      if (action === 'create') {
        result.changedBy = result.id;
      }
      return result;
    });
};
