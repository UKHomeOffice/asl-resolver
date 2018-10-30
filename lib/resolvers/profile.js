const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }) => {
  return resolver({ Model: models.Profile, action, data, id });
};
