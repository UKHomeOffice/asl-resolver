const crypto = require('crypto');

const generateLicenceNumber = (type, isNew) => {
  const buf = crypto.randomBytes(48).toString('hex');
  const digits = buf.replace(/[a-z]/g, '').substring(0, 8);
  switch (type) {
    case 'pil':
      return `I-${digits}`;
    case 'project':
      return isNew ? `PP-${digits.substring(0, 7)}` : `P-${digits}`;
    case 'pel':
      return `X-${digits}`;
  }
};

module.exports = {
  generateLicenceNumber
};
