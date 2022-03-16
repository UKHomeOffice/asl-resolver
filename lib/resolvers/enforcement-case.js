const resolver = require('./base-resolver');

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { EnforcementCase } = models;
  console.log({
    action, data, id
  });

  if (action === 'create') {
    return EnforcementCase.query(transaction).insert(data);
  }

  return resolver({ Model: EnforcementCase, action, data, id }, transaction);
};
