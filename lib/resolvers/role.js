const { get } = require('lodash');
const updateConditions = require('../utils/update-conditions');

module.exports = ({ models }) => async ({action, data, id}, transaction) => {
  // assignment/removal of a HOLC should not trigger an establishment update
  const nopes = [
    'holc'
  ];

  const { Role, Establishment, PlaceRole, Profile, Reminder } = models;
  const {
    establishmentId,
    profileId,
    type,
    role
  } = data;

  const dissociatePlaces = (establishmentId, type) => {
    return PlaceRole.query(transaction)
      .where({ roleId: id })
      .delete();
  };

  const touchEstablishment = (id, type) => {
    if (nopes.includes(type)) {
      return Promise.resolve();
    }
    return Establishment.query(transaction)
      .findById(id)
      .patch({ updatedAt: new Date().toISOString() });
  };

  if (get(data, 'conditions')) {
    let reminder;
    if (get(data, 'reminder')) {
      reminder = JSON.parse(get(data, 'reminder'));
    }
    const condition = get(data, 'conditions');

    await updateConditions(establishmentId, condition, reminder, Reminder, Establishment, transaction);
  }

  if (action === 'create') {
    // renamed `role` to `type` - fallback for b/c
    const typeOfRole = type || role;
    return Role.query(transaction).findOne({ establishmentId, profileId, type: typeOfRole })
      .then(existing => {
        if (existing) {
          return existing;
        }
        return Role.query(transaction)
          .insert({ establishmentId, profileId, type: typeOfRole })
          .returning('*');
      })
      .then(result => touchEstablishment(establishmentId, typeOfRole).then(() => result))
      .then(result => {
        // if adding an NVS save the RCVS number to the profile
        if (typeOfRole === 'nvs' && data.rcvsNumber) {
          return Profile.query(transaction).findById(profileId)
            .then(profile => profile.$query(transaction).patch({ rcvsNumber: data.rcvsNumber }))
            .then(() => result);
        }
        return result;
      });
  }
  if (action === 'delete') {
    let typeOfDeletedRole;
    return Promise.resolve()
      .then(() => Role.query(transaction).findById(id))
      .then(role => {
        typeOfDeletedRole = role.type;
        return role.$query().delete();
      })
      .then(() => dissociatePlaces(establishmentId, typeOfDeletedRole))
      .then(() => touchEstablishment(establishmentId, typeOfDeletedRole))
      .then(() => Role.queryWithDeleted(transaction).findById(id));
  }
  if (action === 'replace') {
    // renamed `role` to `type` - fallback for b/c
    const typeOfRole = type || role;
    const { replaceRoles } = data;
    return Role.query(transaction).where({ establishmentId }).whereIn('type', replaceRoles).delete()
      .then(() => {
        return Role.query(transaction)
          .insert({ establishmentId, profileId, type: typeOfRole })
          .returning('*');
      })
      .then(result => touchEstablishment(establishmentId, typeOfRole).then(() => result));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
