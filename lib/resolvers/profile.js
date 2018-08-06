const { omit } = require('lodash');

module.exports = (db, { action, data, id }) => {
  const { Profile, Permission } = db;

  if (action === 'create') {
    return Profile.query()
      .select('email')
      .then(profiles => profiles.map(p => p.email))
      .then(emails => {
        if (emails.includes(data.email)) {
          throw new Error('Email must be unique')
        }
      })
      .then(() => {
        return Profile.query()
          .insert(omit(data, ['establishment', 'permissions']))
          .then(profile => profile.id)
          .then(profileId => {
            return Permission.query()
              .insert({
                profileId,
                establishmentId: data.establishment,
                role: data.permissions
              })
              // this is needed to stop the default behaviour of
              // returning id as no id col exists in permissions table
              .returning('*')
              // send email with unique link
          })
      })
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));

};
