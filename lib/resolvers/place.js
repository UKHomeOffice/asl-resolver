const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data = {}, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Place, Role } = models;
  const nacwo = data.nacwo;

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
        .then(nacwoId => Place.query(transaction).insert({ ...data, nacwoId }).returning('*'));
    }
    return Place.query(transaction).insert(data).returning('*');
  }

  if (action === 'update') {
    if (nacwo) {
      return getNacwoId(nacwo)
        .then(nacwoId => Place.query(transaction).patchAndFetchById(id, { ...data, nacwoId }));
    }
    return Place.query(transaction).patchAndFetchById(id, data);
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => Place.query(transaction).findById(id).delete())
      .then(() => Place.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
