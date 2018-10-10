const { pick } = require('lodash');

module.exports = ({ models, keycloak, jwt, emailer }) => ({ action, data, id }) => {
  const { Profile, Invitation, Establishment, Permission } = models;

  if (action === 'create') {
    const changelog = [];
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
        return Promise.resolve()
          .then(() => Profile.query().insert(pick(data, 'email', 'firstName', 'lastName')))
          .then(profile => {
            changelog.push({
              model: 'profile',
              state: profile
            });
            return profile;
          });
      })
      .then(profile => {
        if (!profile.userId) {
          console.log(`Creating keycloak account`);
          return keycloak.ensureUser(data)
            .then(user => Profile.query().patchAndFetchById(profile.id, { userId: user.id }))
            .then(profile => {
              changelog.push({
                model: 'profile',
                state: profile
              });
              return profile;
            });
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
          establishmentId: data.establishmentId,
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
              .then(() => Invitation.query().where({ establishmentId: args.establishmentId, profileId: args.profileId }))
              .then(invitations => invitations[0])
              .then(invitation => {
                changelog.push({
                  model: 'invitation',
                  state: invitation
                });
              })
              .then(() => Establishment.query().findById(data.establishmentId))
              .then(e => emailer.sendEmail({ ...data, token, establishmentName: e.name }))
              .then(() => changelog);
          });
      });
  }

  if (action === 'resolve') {
    const changelog = [];
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
          .then(() => Permission.query().where({ establishmentId: model.establishmentId, profileId: model.profileId }))
          .then(permissions => permissions[0])
          .then(permission => {
            changelog.push({
              model: 'permission',
              state: permission
            });
          })
          .then(() => {
            return Invitation.query().where({
              profileId: model.profileId,
              establishmentId: model.establishmentId
            })
              .delete()
              .returning('*');
          })
          .then(invitation => {
            changelog.push({
              model: 'invitation',
              state: invitation
            });
          })
          .then(() => changelog);
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
