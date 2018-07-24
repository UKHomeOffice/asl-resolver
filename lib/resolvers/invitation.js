const jwt = require('../jwt');

module.exports = ({ models, keycloak, jwt }, { action, data, id }) => {
  const { Profile, Invitation } = models;

  if (action === 'create') {
    return Profile.findOne({ where: { email: data.email } })
      .then(existing => {
        if (existing) {
          console.log(`Found existing profile for ${existing.name}`);
          return existing;
        }
        console.log(`Creating new profile for ${data.firstName} ${data.lastName}`);
        return Profile.create(data);
      })
      .then(profile => {
        if (!profile.userId) {
          console.log(`Creating keycloak account`);
          return keycloak.ensureUser(data)
            .then(user => profile.update({ userId: user.id }));
        }
        console.log(`Found existing keycloak account`);
        return profile;
      })
      .then(profile => {
        const args = {
          profileId: profile.id,
          establishmentId: data.establishment
        };
        const token = jwt.sign(args);
        return Invitation.upsert({ ...args, token });
      });
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
