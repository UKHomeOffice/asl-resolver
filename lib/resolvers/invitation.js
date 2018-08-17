const { pick } = require('lodash');
const fetch = require('r2');

module.exports = ({ models, keycloak, jwt, emailer }, { action, data, id }) => {
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
          email: profile.role,
          establishmentId: data.establishment,
          role: data.role
        };
        return Promise.resolve()
          .then(() => jwt.sign(args))
          .then(token => {
            return Promise.resolve()
              .then(() => {
                // returning('*') is to get around a bug in objection where it tries to return `id` by default
                // because we don't have an id column we need to override this
                return Invitation.query().insert({ ...pick(args, ['role', 'establishmentId', 'profileId']), token }).returning('*').catch(e => null);
              })
              .then(() => Establishment.query().findById(data.establishment))
              .then(establishment => {
                return fetch(`${emailer.host}/invitation`, {
                  method: 'POST',
                  json: {
                    acceptLink: `${emailer.registerService}/${token}`,
                    name: `${data.firstName} ${data.lastName}`,
                    establishment: establishment.name,
                    subject: `You have been invited to join ${establishment.name}`,
                    to: data.email
                  }
                })
                .response;
              });
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
            // see above comment re inserting into a table without an id field
            return Permission.query().insert(pick(model, ['establishmentId', 'profileId', 'role'])).returning('*');
          })
          .then(() => Invitation.query().where({ token: data.token }).hardDelete())
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
