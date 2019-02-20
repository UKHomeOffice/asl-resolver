const resolver = require('./base-resolver');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { PIL } = models;

  if (action === 'grant') {
    return PIL.query(transaction)
      .patchAndFetchById(id, {
        status: 'active',
        issueDate: new Date().toISOString(),
        licenceNumber: generateLicenceNumber()
      });
  }

  return resolver({ Model: models.PIL, action, data, id }, transaction);
};
