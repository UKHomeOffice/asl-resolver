module.exports = (db, { action, data, id }) => {
  const { Place } = db;

  if (data.nacwo) {
    data.nacwoId = data.nacwo;
  }
  data.establishmentId = data.establishment;

  if (action === 'create') {
    return Place.create(data);
  }

  if (action === 'update') {
    return Place.scope('all').findOne({ where: { id, establishmentId: data.establishmentId } })
      .then(model => {
        return model && model.update(data);
      });
  }

  if (action === 'delete') {
    return Place.scope('all').findOne({ where: { id, establishmentId: data.establishmentId } })
      .then(model => {
        return model && model.softDelete();
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
