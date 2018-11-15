const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }) => {

  const { Profile } = models;

  if (action === 'create') {
    return Profile.query().where({ email: data.email })
      .then(profiles => profiles[0])
      .then(profile => {
        if (profile) {
          return Profile.query()
            .patchAndFetchById(profile.id, { userId: data.userId });
        }
        return Profile.query()
          .insert(data)
          .returning('*');
      })
      .then(result => {
        result.changedBy = result.id;
        return result;
      });
  }

  return resolver({ Model: models.Profile, action, data, id });
};
