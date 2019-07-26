const resolver = require('./base-resolver');

module.exports = ({ models }) => ({ action, data, id }, transaction) => {

  const { Profile, Project, PIL, Permission, Role, Certificate, Exemption } = models;

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

  if (action === 'merge') {
    const actions = [
      Project.query(transaction).patch({ licenceHolderId: data.target }).where({ licenceHolderId: id }),
      PIL.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
      Permission.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
      Role.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
      Certificate.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
      Exemption.query(transaction).patch({ profileId: data.target }).where({ profileId: id })
    ];

    return Promise.all(actions)
      .then(() => Profile.query(transaction).findById(data.target));
  }

  return resolver({ Model: models.Profile, action, data, id }, transaction);
};
