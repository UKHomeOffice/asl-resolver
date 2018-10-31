const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }) => {
  return resolver({ Model: models.Certificate, action, data, id });
};
