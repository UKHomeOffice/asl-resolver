module.exports = ({ models }) => ({ action, data, changedBy }, transaction) => {

  const { FeeWaiver } = models;

  if (action === 'create') {
    const { establishmentId, pilId, comment } = data;
    const year = parseInt(data.year, 10);
    const profileId = changedBy;
    return FeeWaiver.query(transaction).findOne({ establishmentId, pilId, year })
      .then(result => {
        if (result) {
          return FeeWaiver.query(transaction).findById(result.id).patch({ comment, profileId }).returning('*');
        }
        return FeeWaiver.query(transaction).insert({ establishmentId, pilId, year, comment, profileId });
      });
  }

  if (action === 'delete') {
    const { establishmentId, pilId } = data;
    const year = parseInt(data.year, 10);
    return FeeWaiver.query(transaction).delete().where({ establishmentId, pilId, year }).returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
