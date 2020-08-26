const crypto = require('crypto');

const generateLicenceNumber = ({
  model,
  transaction,
  type,
  version,
  key = 'licenceNumber'
}) => {
  const buf = crypto.randomBytes(48).toString('hex');
  const digits = buf.replace(/[a-z]/g, '').substring(0, 8);
  let licenceNumber;
  switch (type) {
    case 'pil':
      licenceNumber = `I${digits}`;
      break;
    case 'project':
      if (version > 0) {
        licenceNumber = `PP${digits.substring(0, 7)}`;
      } else {
        licenceNumber = `P${digits}`;
      }
      break;
    case 'pel':
      licenceNumber = `X${digits}`;
      break;
  }

  return model
    .query(transaction)
    .findOne({ [key]: licenceNumber })
    .then(existing => {
      if (existing) {
        return generateLicenceNumber({ model, transaction, type, version, key });
      }
      return licenceNumber;
    });
};

module.exports = generateLicenceNumber;
