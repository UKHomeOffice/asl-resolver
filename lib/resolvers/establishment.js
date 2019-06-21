const resolver = require('./base-resolver');
const { pick, omit } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { Establishment, Authorisation } = models;

  if (action === 'update') {
    return Establishment.query(transaction)
      .patchAndFetchById(id, data)
      .then(establishment => {
        return Authorisation.query(transaction)
          .delete()
          .where('establishmentId', id)
          .then(() => {
            if (data.authorisations.length > 0) {
              // strip the ids, these will be inserted as new authorisations
              const authorisations = data.authorisations.map(a => omit(a, 'id'));

              return Authorisation.query(transaction)
                .insert(authorisations);
            }
          })
          .then(() => establishment);
      });
  }

  if (action === 'update-conditions') {
    data = pick(data, 'conditions');
    action = 'update';
  }
  return resolver({ Model: models.Establishment, action, data, id }, transaction);
};
