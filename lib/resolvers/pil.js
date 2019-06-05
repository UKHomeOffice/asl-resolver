const resolver = require('./base-resolver');
const { pick } = require('lodash');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { PIL } = models;

  if (action === 'grant') {
    return Promise.resolve()
      .then(() => resolver({ Model: models.PIL, action: 'update', data, id }, transaction))
      .then(() => PIL.query(transaction).findById(id))
      .then(pil => pil.$query(transaction).patchAndFetch({
        status: 'active',
        issueDate: pil.issueDate || new Date().toISOString(),
        licenceNumber: pil.licenceNumber || generateLicenceNumber()
      }));
  }

  if (action === 'update-conditions') {
    data = pick(data, 'conditions');
    action = 'update';
  }

  return resolver({ Model: models.PIL, action, data, id }, transaction);
};
