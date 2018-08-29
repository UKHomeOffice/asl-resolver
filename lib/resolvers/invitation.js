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
          console.log(`Found existing profile for ${existing.firstName} ${existing.lastName}`);
          return existing;
        }
        console.log(`Creating new profile for ${data.firstName} ${data.lastName}`);
        return Profile.query().insert(pick(data, 'email', 'firstName', 'lastName'));
      })
      .then(profile => {
        if (!profile.userId) {
          console.log(`Creating keycloak account`);
          return keycloak.ensureUser(data)
            .then(user => Profile.query().patchAndFetchById(profile.id, { userId: user.id }));
        }
        console.log(`Found existing keycloak account`);
        return profile;
      })
      .then(profile => {
        const args = {
          profileId: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          establishmentId: data.establishment,
          role: data.role
        };
        return Promise.resolve()
          .then(() => jwt.sign(args))
          .then(token => {
            return Promise.resolve()
              .then(() => {
                return Invitation.upsert({
                  establishmentId: args.establishmentId,
                  profileId: args.profileId,
                  role: args.role,
                  deleted: null,
                  token
                }, {
                  establishmentId: args.establishmentId,
                  profileId: args.profileId
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
          .then(() => Profile.query().findById(model.profileId))
          .then(profile => profile.userId)
          .then(id => {
            if (data.password) {
              return keycloak.setUserPassword(id, data.password);
            }
          })
          .then(() => {
            return Permission.upsert({
              role: model.role,
              establishmentId: model.establishmentId,
              profileId: model.profileId,
              deleted: null
            }, {
              establishmentId: model.establishmentId,
              profileId: model.profileId
            });
          })
          .then(() => Invitation.query().where({
            profileId: model.profileId,
            establishmentId: model.establishmentId
          }).delete());
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
