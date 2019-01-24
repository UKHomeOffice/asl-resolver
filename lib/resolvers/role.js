module.exports = ({ models }) => ({ action, data, id }, transaction) => {

  const { Role } = models;
  const {
    establishmentId,
    profileId,
    role
  } = data;

  if (action === 'create') {
    return Role.query(transaction)
      .insert({ establishmentId, profileId, type: role })
      .returning('*');
  }
  if (action === 'delete') {
    return Promise.resolve()
      .then(() => {
        return Role.query(transaction).findOne({
          establishmentId,
          profileId,
          role: data.type
        }).delete();
      })
      .then(() => Role.queryWithDeleted(transaction).findById(id));
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
