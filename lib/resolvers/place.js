const { pick, uniq } = require('lodash');

module.exports = ({ models }) => async ({ action, data = {}, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Place, Role, Establishment } = models;

  const getNacwoRoleId = profileId => {
    if (profileId) {
      return Role.query(transaction)
        .findOne({ establishmentId: data.establishmentId, profileId, type: 'nacwo' })
        .then(role => role.id);
    }
    return Promise.resolve(null);
  };

  const nacwoProfileId = data.nacwo; // old style tasks before mutliple nacwos per place were allowed
  let requestedRoles = data.roles || [];

  if (nacwoProfileId) {
    const nacwoRoleId = await getNacwoRoleId(nacwoProfileId);
    requestedRoles.push(nacwoRoleId);
  }

  requestedRoles = uniq(requestedRoles.filter(Boolean));

  const touchEstablishment = (id) => {
    return Establishment.query(transaction)
      .findById(id)
      .patch({ updatedAt: new Date().toISOString() });
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
    const place = await Place.query(transaction).insert(data).returning('*');
    await Place.relatedQuery('roles', transaction).for(place).relate(requestedRoles);
    return touchEstablishment(place.establishmentId).then(() => place);
  }

  if (action === 'update') {
    const place = await Place.query(transaction)
      .patchAndFetchById(id, data)
      .withGraphFetched('roles.[profile]');

    const newRoles = requestedRoles.filter(roleId => !place.roles.find(r => r.id === roleId));

    await Place.relatedQuery('roles', transaction).for(place).whereNotIn('id', requestedRoles).unrelate();
    await Place.relatedQuery('roles', transaction).for(place).relate(newRoles);
    return touchEstablishment(place.establishmentId).then(() => place);
  }

  if (action === 'delete') {
    await Place.query(transaction).findById(id).delete();
    const deletedPlace = await Place.queryWithDeleted(transaction).findById(id);
    return touchEstablishment(deletedPlace.establishmentId).then(() => deletedPlace);
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
