const { pick } = require('lodash');

module.exports = ({ models, jwt, emailer }) => ({ action, data }) => {
  const { Invitation, Establishment, Permission } = models;

  if (action === 'create') {
    const changelog = [];
      const args = {
        email: data.email,
        establishmentId: data.establishmentId,
        role: data.role
      };
      return Promise.resolve()
        .then(() => jwt.sign(args))
        .then(token => {
          return Promise.resolve()
            .then(() => {
              return Invitation.upsert({ ...args, token }, {
                establishmentId: args.establishmentId,
                email: args.email
              });
            })
            .then(() => Invitation.query().where({ establishmentId: args.establishmentId, email: args.email }))
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
  }

  if (action === 'accept') {
    const changelog = [];
    return Promise.resolve()
      .then(() => Invitation.query().findById(data.id))
      .then(invitation => {
        return Promise.resolve()
          .then(() => {
            return Permission.upsert({
              role: invitation.role,
              establishmentId: invitation.establishmentId,
              profileId: data.profileId,
              deleted: null
            }, {
              establishmentId: invitation.establishmentId,
              profileId: data.profileId
            });
          })
          .then(() => Permission.query().where({ establishmentId: invitation.establishmentId, profileId: data.profileId }))
          .then(permissions => permissions[0])
          .then(permission => {
            changelog.push({
              model: 'permission',
              state: permission
            });
          })
          .then(() => {
            return Invitation.query().where({
              id: data.id
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
