const { pick } = require('lodash');
const fetch = require('r2');

module.exports = ({ models, keycloak, jwt, emailer }, { action, data, id }) => {
  const { Profile, Invitation, Establishment } = models;

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
          establishmentId: data.establishment,
          role: data.role
        };
        const token = jwt.sign(args);
        return Invitation.query().insert({ ...args, token }).returning('*');
      })
      .then(() => Establishment.query().findById(data.establishment))
      .then(establishment => {
        return fetch(`${emailer.host}/invitation`, {
          method: 'POST',
          json: {
            name: `${data.firstName} ${data.lastName}`,
            establishment: establishment.name,
            subject: `You have been invited to join ${establishment.name}`,
            token: data.token,
            to: data.email
          }
        })
          .response;
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
