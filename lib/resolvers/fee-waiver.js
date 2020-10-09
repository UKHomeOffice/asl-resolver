module.exports = ({ models }) => ({ action, data, changedBy }, transaction) => {

  const { FeeWaiver } = models;

  if (action === 'create') {
    const { establishmentId, profileId, comment } = data;
    const year = parseInt(data.year, 10);
    const waivedById = changedBy;
    return FeeWaiver.query(transaction).findOne({ establishmentId, profileId, year })
      .then(result => {
        if (result) {
          return FeeWaiver.query(transaction).findById(result.id).patch({ comment, waivedById }).returning('*');
        }
        return FeeWaiver.query(transaction).insert({ establishmentId, profileId, year, comment, waivedById });
      });
  }

  if (action === 'delete') {
    const { establishmentId, profileId } = data;
    const year = parseInt(data.year, 10);
    return FeeWaiver.query(transaction).delete().where({ establishmentId, profileId, year }).returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
