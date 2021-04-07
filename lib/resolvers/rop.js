const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  if (action === 'submit') {
    return models.Rop.query(transaction).patchAndFetchById(id, { status: 'submitted', submittedDate: new Date().toISOString() });
  }
  if (action === 'unsubmit') {
    return models.Rop.query(transaction).patchAndFetchById(id, { status: 'draft' });
  }
  return resolver({ Model: models.Rop, action, data, id }, transaction);
};
