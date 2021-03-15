const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  if (action === 'submit') {
    return models.Rop.query(transaction).patchAndFetchById(id, { status: 'submitted' });
  }
  return resolver({ Model: models.Rop, action, data, id }, transaction);
};
