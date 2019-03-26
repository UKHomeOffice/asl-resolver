module.exports = ({ models }) => ({ action, data, id }, transaction) => {

  const { Role } = models;
  const {
    establishmentId,
    profileId,
    type,
    role
  } = data;

  if (action === 'create') {
    // renamed `role` to `type` - fallback for b/c
    return Role.query(transaction).findOne({ establishmentId, profileId, type: type || role })
      .then(existing => {
        if (existing) {
          return existing;
        }
        return Role.query(transaction)
          // renamed `role` to `type` - fallback for b/c
          .insert({ establishmentId, profileId, type: type || role })
          .returning('*');
      });
  }
  if (action === 'delete') {
    return Promise.resolve()
      .then(() => {
        return Role.query(transaction).findById(id).delete();
      })
      .then(() => Role.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};