const { pick } = require('lodash');

module.exports = ({ models }) => ({ action, data, id }) => {
  const { Place } = models;

  if (data) {
    if (data.nacwo) {
      data.nacwoId = data.nacwo;
    }
    data.establishmentId = data.establishment;

    data = pick(data, 'id', 'site', 'area', 'name', 'suitability', 'holding', 'nacwoId', 'establishmentId');

    if (typeof data.suitability === 'string') {
      data.suitability = JSON.parse(data.suitability);
    }
    if (typeof data.holding === 'string') {
      data.holding = JSON.parse(data.holding);
    }
  }

  if (!id && (action === 'update' || action === 'delete')) {
    return Promise.reject(new Error(`id is required on ${action}`));
  }

  if (action === 'create') {
    return Place.query()
      .insert(data);
  }

  if (action === 'update') {
    return Place.query()
      .findById(id)
      .patch(data);
  }

  if (action === 'delete') {
    return Place.query()
      .findById(id)
      .delete();
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
