const resolver = require('./base-resolver');
const { pick, omit } = require('lodash');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { Establishment, Authorisation } = models;

  if (action === 'update') {
    const establishment = await Establishment.query(transaction).patchAndFetchById(id, data);

    if (data.authorisations) {
      await Authorisation.query(transaction).delete().where('establishmentId', id);
      if (data.authorisations.length) {
        // strip the ids, these will be inserted as new authorisations
        const authorisations = data.authorisations.map(a => omit(a, 'id'));
        await Authorisation.query(transaction).insert(authorisations);
      }
    }

    return establishment;
  }

  if (action === 'update-conditions') {
    data = pick(data, 'conditions');
    action = 'update';
  }

  if (action === 'update-billing') {
    data = { billing: data };
    action = 'update';
  }

  if (action === 'grant') {
    return Promise.resolve()
      .then(() => generateLicenceNumber({ model: Establishment, transaction, type: 'pel' }))
      .then(licenceNumber => {
        return Establishment.query(transaction).findById(id)
          .then(establishment => establishment.$query(transaction).patchAndFetch({
            status: 'active',
            issueDate: new Date().toISOString(),
            licenceNumber: establishment.licenceNumber || licenceNumber
          }));
      });
  }

  if (action === 'revoke') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.Establishment, action, data, id }, transaction);
};
