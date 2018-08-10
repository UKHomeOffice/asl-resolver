const { pick } = require('lodash');

module.exports = ({ models }, { action, data, id }) => {
  const { Place } = models;

  if (data.nacwo) {
    data.nacwoId = data.nacwo;
  }

  data.establishmentId = data.establishment;

  data = pick(data, 'id', 'site', 'area', 'name', 'suitability', 'holding', 'nacwoId', 'establishmentId');

  data.suitability = JSON.stringify(data.suitability);
  data.holding = JSON.stringify(data.holding);

  if (action === 'create') {
    return Place.query()
      .insert(data);
  }

  if (action === 'update') {
    return Place.query()
      .patch(data)
      .where({ id, establishmentId: data.establishmentId });
  }

  if (action === 'delete') {
    return Place.query()
      .delete()
      .where({ id, establishmentId: data.establishmentId });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
