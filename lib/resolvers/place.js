const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data = {}, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Place, Role, Establishment } = models;
  const nacwo = data.nacwo;

  const touchEstablishment = (id) => {
    return Establishment.query(transaction)
      .findById(id)
      .patch({ updatedAt: new Date().toISOString() });
  };

  const getNacwoId = profileId => {
    if (profileId) {
      return Role.query(transaction)
        .findOne({ establishmentId: data.establishmentId, profileId, type: 'nacwo' })
        .then(role => role.id);
    }
    return Promise.resolve(null);
  };

  if (action === 'create' || action === 'update') {
    data = pick(data, Object.keys(Place.jsonSchema.properties));

    if (typeof data.suitability === 'string') {
      data.suitability = JSON.parse(data.suitability);
    }
    if (typeof data.holding === 'string') {
      data.holding = JSON.parse(data.holding);
    }
  }

  if (action === 'create') {
    if (nacwo) {
      return getNacwoId(nacwo)
        .then(nacwoId => Place.query(transaction).insert({ ...data, nacwoId }).returning('*'))
        .then(result => {
          return touchEstablishment(result.establishmentId).then(() => result);
        });
    }
    return Place.query(transaction).insert(data).returning('*')
      .then(result => {
        return touchEstablishment(result.establishmentId).then(() => result);
      });
  }

  if (action === 'update') {
    if (nacwo) {
      return getNacwoId(nacwo)
        .then(nacwoId => Place.query(transaction).patchAndFetchById(id, { ...data, nacwoId }))
        .then(result => {
          return touchEstablishment(result.establishmentId).then(() => result);
        });
    }
    return Place.query(transaction).patchAndFetchById(id, data)
      .then(result => {
        return touchEstablishment(result.establishmentId).then(() => result);
      });
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => Place.query(transaction).findById(id).delete())
      .then(() => Place.queryWithDeleted(transaction).findById(id))
      .then(result => {
        return touchEstablishment(result.establishmentId).then(() => result);
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
