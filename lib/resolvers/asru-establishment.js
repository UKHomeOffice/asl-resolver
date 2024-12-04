module.exports = ({ models }) => async ({ action, data }, transaction) => {
  const { AsruEstablishment } = await models;
  const { establishmentId, profileId } = await data;

  if (action === 'create') {
    const existing = await AsruEstablishment.query(transaction)
      .findOne({ establishmentId, profileId });

    if (existing) {
      return existing;
    } else {
      return AsruEstablishment.query(transaction)
        .insert({ establishmentId, profileId })
        .returning('*');
    }
  }

  if (action === 'delete') {
    const hardDelete = await AsruEstablishment.query(transaction)
      .hardDelete()
      .where({ profileId: profileId, establishmentId: establishmentId })
      .returning('*');
    console.log(hardDelete);

    return hardDelete;
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
