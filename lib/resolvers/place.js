const { pick, uniq, get } = require('lodash');
const updateConditions = require('../utils/update-conditions');

module.exports = ({ models }) => async ({ action, data = {}, id }, transaction) => {
  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  const { Place, Role, PlaceRole, Establishment, Reminder } = models;

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

  let reminder;
  if (get(data, 'reminder')) {
    reminder = JSON.parse(get(data, 'reminder'));
  }
  const condition = get(data, 'conditions');
  const establishmentId = get(data, 'establishmentId');

  await updateConditions(establishmentId, condition, reminder, Reminder, Establishment, transaction);

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
    if (requestedRoles.length > 0) {
      await Place.relatedQuery('roles', transaction).for(place).relate(requestedRoles);
    }
    return touchEstablishment(place.establishmentId).then(() => place);
  }

  if (action === 'update') {
    const place = await Place.query(transaction).patchAndFetchById(id, data);

    const allRoles = await Role.query(transaction).select('id').where({ establishmentId: place.establishmentId });

    const existingRoles = await Role.query(transaction)
      .join('placeRoles', 'roles.id', '=', 'placeRoles.roleId')
      .where('placeRoles.placeId', id)
      .whereNull('placeRoles.deleted');

    const newRoles = requestedRoles
      .filter(roleId => allRoles.find(r => r.id === roleId))
      .filter(roleId => !existingRoles.find(r => r.id === roleId));

    const removedRoles = existingRoles.filter(r => !requestedRoles.includes(r.id)).map(r => r.id);

    await PlaceRole.query(transaction).where({ placeId: id }).whereIn('roleId', removedRoles).delete(); // soft delete
    if (newRoles.length > 0) {
      await Place.relatedQuery('roles', transaction).for(place).relate(newRoles);
    }
    return touchEstablishment(place.establishmentId).then(() => place);
  }

  if (action === 'delete') {
    await Place.query(transaction).findById(id).delete();
    const deletedPlace = await Place.queryWithDeleted(transaction).findById(id);
    return touchEstablishment(deletedPlace.establishmentId).then(() => deletedPlace);
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
