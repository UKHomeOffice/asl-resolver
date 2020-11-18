const fetch = require('r2');
const { isEmpty } = require('lodash');

module.exports = ({ host, registerService }, logger) => {
  return {
    sendEmail: email => {
      let json = {};
      let failMessage = '';

      const name = email.firstName && email.lastName && `${email.firstName} ${email.lastName}`;

      switch (email.template) {
        case 'invitation':
          json = {
            name,
            acceptLink: `${registerService}/invitation/${email.token}`,
            establishment: email.establishment.name,
            subject: `You have been invited to join ${email.establishment.name}`,
            to: email.email
          };
          failMessage = `failed to send invite email to "${email.email}" for "${email.establishment.name}"`;
          break;

        case 'confirm-email':
          json = {
            name,
            acceptLink: `${registerService}/confirm-email/${email.token}`,
            subject: `Confirm your email address`,
            to: email.email
          };
          failMessage = `failed to send confirmation email to "${email.email}"`;
          break;

        case 'change-email':
          json = {
            to: `${email.oldEmail},${email.email}`,
            name: `${email.firstName} ${email.lastName}`,
            subject: `Your email address has been changed`,
            oldEmail: email.oldEmail,
            newEmail: email.email
          };
          failMessage = `failed to send an email address change notification to ${email.oldEmail} and ${email.email}`;
          break;
      }

      if (isEmpty(json)) {
        logger.info(`no email content could be determined, check the template '${email.template}' exists`);
        return Promise.resolve();
      }

      return Promise.resolve()
        .then(() => fetch(`${host}/${email.template}`, { method: 'POST', json }).response)
        .catch(error => {
          logger.error(failMessage);
          logger.error('error was: ', error);
        });
    }
  };
};
