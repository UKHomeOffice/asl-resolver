const resolver = require('./base-resolver');
const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  if (action === 'update-conditions') {
    data = pick(data, 'conditions');
    action = 'update';
  }
  return resolver({ Model: models.Establishment, action, data, id }, transaction);
};
