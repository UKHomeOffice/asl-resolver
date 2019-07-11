const resolver = require('./base-resolver');
const { pick } = require('lodash');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { PIL } = models;

  if (action === 'grant') {
    if (Array.isArray(data.species)) {
      data.species = data.species.filter(Boolean);

      if (!data.species.length) {
        data.species = null;
      }
    }
    return Promise.resolve()
      .then(() => resolver({ Model: models.PIL, action: 'update', data, id }, transaction))
      .then(() => PIL.query(transaction).findById(id))
      .then(pil => pil.$query(transaction).patchAndFetch({
        status: 'active',
        issueDate: pil.issueDate || new Date().toISOString(),
        licenceNumber: pil.licenceNumber || generateLicenceNumber('pil')
      }));
  }

  if (action === 'update-conditions') {
    data = pick(data, 'conditions');
    action = 'update';
  }

  if (action === 'revoke') {
    return PIL.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.PIL, action, data, id }, transaction);
};
