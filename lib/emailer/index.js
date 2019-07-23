const fetch = require('r2');

module.exports = ({ host, registerService }) => {
  return {
    sendEmail: data => {
      return Promise.resolve()
        .then(() => {
          return fetch(`${host}/invitation`, {
            method: 'POST',
            json: {
              acceptLink: `${registerService}/invitation/${data.token}`,
              name: `${data.firstName} ${data.lastName}`,
              establishment: data.establishmentName,
              subject: `You have been invited to join ${data.establishmentName}`,
              to: data.email
            }
          })
            .response;
        })
        .catch(error => {
          console.log(`failed to send invite email to "${data.email}" for "${data.establishmentName}"`);
          console.log('error was: ', error);
        });
    }
  };
};
