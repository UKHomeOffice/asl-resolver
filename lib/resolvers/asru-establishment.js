module.exports = ({ models }) => ({ action, data }, transaction) => {
  const { AsruEstablishment } = models;
  const { establishmentId, profileId } = data;

  if (action === 'create') {
    return AsruEstablishment.query(transaction)
      .findOne({ establishmentId, profileId })
      .then(existing => {
        if (existing) {
          return existing;
        }
        return AsruEstablishment.query(transaction)
          .insert({ establishmentId, profileId })
          .returning('*');
      });
  }

  if (action === 'delete') {
    return AsruEstablishment.query(transaction)
      .hardDelete()
      .where({ profileId: profileId, establishmentId: establishmentId })
      .returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
