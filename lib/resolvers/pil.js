const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  return resolver({ Model: models.PIL, action, data, id }, transaction);
};
