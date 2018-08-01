module.exports = (db, { action, data, id }) => {
  const { Place } = db;

  if (data.nacwo) {
    data.nacwoId = data.nacwo;
  }
  data.establishmentId = data.establishment;

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
