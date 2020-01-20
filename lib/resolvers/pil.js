const { pick } = require('lodash');
const moment = require('moment');
const resolver = require('./base-resolver');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id, changedBy }, transaction) => {
  const { PIL, PilTransfer, Profile } = models;

  if (action === 'transfer') {
    return PIL.query(transaction).findById(id)
      .then(pil => pil.$query(transaction).patchAndFetch({
        establishmentId: data.establishment.to.id,
        species: data.species,
        procedures: data.procedures,
        notesCatD: data.notesCatD,
        notesCatF: data.notesCatF
      }))
      .then(pil => {
        return PilTransfer.query(transaction).insert({
          pilId: pil.id,
          fromEstablishmentId: data.establishment.from.id,
          toEstablishmentId: data.establishment.to.id
        })
          .then(() => pil);
      });
  }

  if (action === 'grant') {
    if (Array.isArray(data.species)) {
      data.species = data.species.filter(Boolean);

      if (!data.species.length) {
        data.species = null;
      }
    }

    const licenceNumber = await generateLicenceNumber(PIL, transaction, 'pil');
    const pil = await PIL.query(transaction).findById(id);
    const profile = await Profile.query(transaction).findById(changedBy);

    const patch = {
      status: 'active',
      issueDate: new Date().toISOString(),
      licenceNumber: pil.licenceNumber || licenceNumber,
      species: data.species,
      procedures: data.procedures,
      notesCatD: data.notesCatD,
      notesCatF: data.notesCatF
    };

    if (!profile.asruUser) {
      patch.reviewDate = moment(patch.issueDate).add(5, 'years').toISOString();
    }

    return pil.$query(transaction).patchAndFetch(patch);
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
