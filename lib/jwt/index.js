const jwt = require('jsonwebtoken');

module.exports = settings => {

  return {
    sign: payload => {
      return jwt.sign({ ...payload, expiresIn: settings.expiry }, settings.secret);
    },
    verify: token => {
      return new Promise((resolve, reject) => {
        jwt.verify(token, settings.secret, (err, token) => {
          err ? reject(err) : resolve(token);
        });
      });
    }
  };

};
