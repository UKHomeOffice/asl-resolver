const resolver = require('./base-resolver');
const { get, pick, omit } = require('lodash');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { Establishment, Authorisation, Reminder, Role } = models;

  if (action === 'update') {

    let reminder;
    if (get(data, 'reminder')) {
      reminder = JSON.parse(get(data, 'reminder'));
    }
    delete data.reminder;

    if (data.conditions === '') {
      data.conditions = null;
    }

    const isCorporate = data.corporateStatus === 'corporate';
    const newProfileRole = isCorporate ? data.nprc : data.pelh;
    delete data.pelh;
    delete data.nprc;
    if (!isCorporate) {
      // Unset legal responsible person details
      data.legalName = null;
      data.legalEmail = null;
      data.legalPhone = null;
    }

    const establishment = await Establishment.query(transaction).patchAndFetchById(id, data);

    if (data.authorisations) {
      await Authorisation.query(transaction).delete().where('establishmentId', id);
      if (data.authorisations.length) {
        // strip the ids, these will be inserted as new authorisations
        const authorisations = data.authorisations.map(a => omit(a, 'id'));
        await Authorisation.query(transaction).insert(authorisations);
      }
    }

    // If corporate status is set, check NPRC/PELH depending on status
    if (data.corporateStatus) {
      const typeOfRole = isCorporate ? 'nprc' : 'pelh';
      const typeOfRoleToRemove = isCorporate ? 'pelh' : 'nprc';

      await Role.upsert({
        establishmentId: establishment.id,
        profileId: newProfileRole,
        type: typeOfRole,
        deleted: null
      }, {
        establishmentId: establishment.id,
        profileId: newProfileRole,
        type: typeOfRole
      }, transaction);

      await Role.query(transaction).where({ establishmentId: establishment.id, type: typeOfRole }).whereNot({profileId: newProfileRole}).delete();
      await Role.query(transaction).where({ establishmentId: establishment.id, type: typeOfRoleToRemove }).delete();
    }

    if (reminder) {
      await Reminder.upsert({
        ...reminder,
        modelType: 'establishment',
        establishmentId: id,
        status: 'active',
        deleted: reminder.deleted ? new Date().toISOString() : undefined
      }, undefined, transaction);
    }

    return establishment;
  }

  if (action === 'update-conditions') {
    const reminder = get(data, 'reminder');
    data = pick(data, 'conditions');
    action = 'update';

    if (reminder) {
      await Reminder.upsert({
        ...reminder,
        modelType: 'establishment',
        establishmentId: id,
        status: 'active',
        deleted: reminder.deleted ? new Date().toISOString() : undefined
      }, undefined, transaction);
    }
  }

  if (action === 'update-billing') {
    data = { billing: { ...data, updatedAt: new Date().toISOString() } };
    return Establishment.query(transaction).context({ preserveUpdatedAt: true }).patchAndFetchById(id, data);
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

  if (action === 'suspend') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      suspendedDate: new Date().toISOString()
    });
  }

  if (action === 'reinstate') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      suspendedDate: null
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
