const fetch = require('r2');

module.exports = ({ host, registerService }) => {
  return {
    sendEmail: data => {
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
    }
  };
};
