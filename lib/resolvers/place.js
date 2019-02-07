const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data = {}, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Place, Role } = models;
  const nacwo = data.nacwo;

  const getNacwoId = profileId => {
    return Role.query()
      .findOne({ establishmentId: data.establishmentId, profileId })
      .then(role => role.id)
  }

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
    return getNacwoId(nacwo)
      .then(nacwoId => Place.query(transaction).insert({ ...data, nacwoId }).returning('*'))
  }

  if (action === 'update') {
    return getNacwoId(nacwo)
      .then(nacwoId => Place.query(transaction).patchAndFetchById(id, { ...data, nacwoId }))
  }

  if (action === 'delete') {
    return Promise.resolve()
      .then(() => Place.query(transaction).findById(id).delete())
      .then(() => Place.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
