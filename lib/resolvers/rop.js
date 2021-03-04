const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  if (action === 'create') {
    data.year = 2021;
  }
  return resolver({ Model: models.Rop, action, data, id }, transaction);
};
