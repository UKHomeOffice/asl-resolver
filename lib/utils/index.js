const crypto = require('crypto');

// todo: generate proper licence numbers
const generateLicenceNumber = () => {
  const buf = crypto.randomBytes(48).toString('hex');
  const chars = buf.replace(/[0-9]/g, '').substring(0, 2).toUpperCase();
  const digits = buf.replace(/[a-z]/g, '').substring(0, 6);
  return `${chars}-${digits}`;
};

module.exports = {
  generateLicenceNumber
};
