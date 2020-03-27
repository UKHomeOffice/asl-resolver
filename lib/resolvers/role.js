module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  // assignment/removal of a HOLC should not trigger an establishment update
  const nopes = [
    'holc'
  ];

  const { Role, Establishment, Place } = models;
  const {
    establishmentId,
    profileId,
    type,
    role
  } = data;

  const dissociateNacwo = (establishmentId, type) => {
    if (type !== 'nacwo') {
      return Promise.resolve();
    }

    return Place.query(transaction)
      .where({ establishmentId, nacwoId: id })
      .patch({ nacwoId: null });
  };

  const touchEstablishment = (id, type) => {
    if (nopes.includes(type)) {
      return Promise.resolve();
    }
    return Establishment.query(transaction)
      .findById(id)
      .patch({ updatedAt: new Date().toISOString() });
  };

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
      .then(result => touchEstablishment(establishmentId, typeOfRole).then(() => result));
  }
  if (action === 'delete') {
    let typeOfDeletedRole;
    return Promise.resolve()
      .then(() => Role.query(transaction).findById(id))
      .then(role => {
        typeOfDeletedRole = role.type;
        return role.$query().delete();
      })
      .then(() => dissociateNacwo(establishmentId, typeOfDeletedRole))
      .then(() => touchEstablishment(establishmentId, typeOfDeletedRole))
      .then(() => Role.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
