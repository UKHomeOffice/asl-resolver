const { pick, omit } = require('lodash');
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

    const pil = await PIL.query(transaction).findById(id);
    const pilHolder = await Profile.query(transaction).findById(pil.profileId);

    if (!pilHolder.pilLicenceNumber) {
      const pilLicenceNumber = await generateLicenceNumber({ model: Profile, transaction, type: 'pil', key: 'pilLicenceNumber' });
      await pilHolder.$query(transaction).patch({ pilLicenceNumber });
    }

    if (pil.status === 'revoked') {
      return PIL.query(transaction).insert({
        ...omit(pil, 'id', 'revocationDate'),
        status: 'active',
        issueDate: moment().toISOString(),
        reviewDate: moment().add(5, 'years').toISOString(),
        species: data.species,
        procedures: data.procedures,
        notesCatD: data.notesCatD,
        notesCatF: data.notesCatF
      });
    }

    const issueDate = pil.status === 'active' ? pil.issueDate : moment().toISOString();
    const patch = {
      status: 'active',
      issueDate,
      species: data.species,
      procedures: data.procedures,
      notesCatD: data.notesCatD,
      notesCatF: data.notesCatF
    };

    const submitter = await Profile.query(transaction).findById(changedBy);
    if (!submitter.asruUser) {
      patch.reviewDate = moment().add(5, 'years').toISOString();
    }

    return pil.$query(transaction).patchAndFetch(patch);
  }

  if (action === 'review') {
    data = {
      reviewDate: moment().add(5, 'years').toISOString()
    };
    action = 'update';
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
