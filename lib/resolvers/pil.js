const crypto = require('crypto');
const resolver = require('./base-resolver');

// todo: generate proper licence numbers
const generateLicenceNumber = () => {
  const buf = crypto.randomBytes(48).toString('hex');
  const chars = buf.replace(/[0-9]/g, '').substring(0, 2).toUpperCase();
  const digits = buf.replace(/[a-z]/g, '').substring(0, 6);
  return `${chars}-${digits}`;
};

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
