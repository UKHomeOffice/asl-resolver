const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  return resolver({ Model: models.Certificate, action, data, id }, transaction);
};
