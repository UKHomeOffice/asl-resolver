const { get, pick, omit } = require('lodash');
const moment = require('moment');
const resolver = require('./base-resolver');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id, changedBy }, transaction) => {
  const { PIL, PilTransfer, Profile, Reminder } = models;

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
    const reminder = get(data, 'reminder');
    data = pick(data, 'conditions');
    action = 'update';

    if (reminder) {
      const pil = await PIL.query(transaction).findById(id);

      await Reminder.upsert({
        ...reminder,
        modelType: 'pil',
        modelId: id,
        establishmentId: pil.establishmentId,
        status: 'active',
        deleted: reminder.deleted ? new Date().toISOString() : undefined
      }, undefined, transaction);
    }
  }

  if (action === 'suspend') {
    console.log('suspending licence');
    return PIL.query(transaction).patchAndFetchById(id, {
      suspendedDate: new Date().toISOString()
    });
  }

  if (action === 'reinstate') {
    console.log('reinsating licence');
    return PIL.query(transaction).patchAndFetchById(id, {
      suspendedDate: null
    });
  }

  if (action === 'revoke') {
    return PIL.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.PIL, action, data, id }, transaction);
};
