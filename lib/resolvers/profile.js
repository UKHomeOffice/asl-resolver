const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {

  const { Profile } = models;

  if (action === 'create') {
    return Profile.query(transaction).findOne({ email: data.email })
      .then(profile => {
        if (profile) {
          return Profile.query(transaction)
            .patchAndFetchById(profile.id, { userId: data.userId });
        }
        return Profile.query(transaction)
          .insert(data)
          .returning('*');
      })
      .then(result => {
        result.changedBy = result.id;
        return result;
      });
  }

  return resolver({ Model: models.Profile, action, data, id }, transaction);
};
