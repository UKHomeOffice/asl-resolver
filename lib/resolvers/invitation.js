const { pick } = require('lodash');

module.exports = ({ models, keycloak, jwt, emailer }) => ({ action, data, id }) => {
  const { Profile, Invitation, Establishment, Permission } = models;

  if (action === 'create') {
    return Profile.query()
      .where('email', data.email)
      .then(profiles => profiles[0])
      .then(existing => {
        console.log(existing);
        if (existing) {
          console.log(`Found existing profile for ${existing.first_name} ${existing.last_name}`);
          return existing;
        }
        console.log(`Creating new profile for ${data.first_name} ${data.last}`);
        return Profile.query().insert(pick(data, 'email', 'first_name', 'last_name'));
      })
      .then(profile => {
        if (!profile.user_id) {
          console.log(`Creating keycloak account`);
          return keycloak.ensureUser(data)
            .then(user => Profile.query().patchAndFetchById(profile.id, { user_id: user.id }));
        }
        console.log(`Found existing keycloak account`);
        return profile;
      })
      .then(profile => {
        const args = {
          profileId: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          establishment_id: data.establishment,
          role: data.role
        };
        return Promise.resolve()
          .then(() => jwt.sign(args))
          .then(token => {
            return Promise.resolve()
              .then(() => {
                return Invitation.upsert({
                  establishment_id: args.establishment_id,
                  profile_id: args.profile_id,
                  role: args.role,
                  deleted: null,
                  token
                }, {
                  establishment_id: args.establishment_id,
                  profile_id: args.profile_id
                });
              })
              .then(() => Establishment.query().findById(data.establishment))
              .then(e => emailer.sendEmail({ ...data, token, establishmentName: e.name }));
          });
      });
  }

  if (action === 'resolve') {
    return Promise.resolve()
      .then(() => jwt.verify(data.token))
      .then(model => {
        return Promise.resolve()
          .then(() => Profile.query().findById(model.profile_id))
          .then(profile => profile.user_id)
          .then(id => {
            if (data.password) {
              return keycloak.setUserPassword(id, data.password);
            }
          })
          .then(() => {
            return Permission.upsert({
              role: model.role,
              establishment_id: model.establishment_id,
              profile_id: model.profile_id,
              deleted: null
            }, {
              establishment_id: model.establishment_id,
              profile_id: model.profile_id
            });
          })
          .then(() => Invitation.query().where({
            profile_id: model.profile_id,
            establishment_id: model.establishment_id
          }).delete());
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
