const resolver = require('./base-resolver');

module.exports = ({ models, keycloak, emailer }) => ({ action, data, id }, transaction) => {

  const { Profile, Project, PIL, Permission, Role, Certificate, Exemption } = models;

  if (action === 'create') {
    return Profile.query(transaction)
      .where('email', 'iLike', data.email)
      .first()
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

    return Promise.resolve()
      .then(() => Promise.all([
        PIL.query(transaction).where({ profileId: id, status: 'active' }),
        PIL.query(transaction).where({ profileId: data.target, status: 'active' })
      ]))
      .then(([pil1, pil2]) => {
        if (pil1.length && pil2.length) {
          throw new Error('Cannot merge profiles as both have an active PIL');
        }
      })
      .then(() => {
        return Permission.query(transaction).select().where({ profileId: id });
      })
      .then(permissions => {
        const queries = permissions.map(p => {
          return Permission.upsert({ ...p, profileId: data.target }, { establishmentId: p.establishmentId, profileId: data.target }, transaction);
        });
        return Promise.all(queries);
      })
      .then(() => console.log('Created new permissions'))
      .then(() => Permission.query(transaction).hardDelete().where({ profileId: id }))
      .then(() => console.log('Removed old permissions'))
      .then(() => {
        const actions = [
          Project.query(transaction).patch({ licenceHolderId: data.target }).where({ licenceHolderId: id }),
          PIL.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
          Role.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
          Certificate.query(transaction).patch({ profileId: data.target }).where({ profileId: id }),
          Exemption.query(transaction).patch({ profileId: data.target }).where({ profileId: id })
        ];
        return Promise.all(actions);
      })
      .then(() => console.log('Mapped all actions'))
      .then(() => Profile.query(transaction).findById(data.target));
  }

  if (action === 'update' && data.email) {
    let oldEmail = '';

    // attempt to update email in keycloak
    return Promise.resolve()
      .then(() => keycloak.grantToken())
      .then(accessToken => {
        return Profile.query(transaction).findById(id)
          .then(profile => {
            oldEmail = profile.email;
            return { id: profile.userId, email: data.email };
          })
          .then(user => keycloak.updateUser({ accessToken, user }));
      })
      .then(() => resolver({ Model: models.Profile, action, data, id }, transaction))
      .then(profile => emailer.sendEmail({ template: 'change-email', ...profile, oldEmail }))
      .catch(err => {
        const error = new Error('There was a problem updating the user in keycloak');
        error.keycloak = err;
        throw error;
      });
  }

  return resolver({ Model: models.Profile, action, data, id }, transaction);
};
