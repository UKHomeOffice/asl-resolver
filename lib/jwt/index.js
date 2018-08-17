const jwt = require('jsonwebtoken');

module.exports = settings => {

  return {
    sign: payload => {
      return jwt.sign({ ...payload, expiresIn: settings.expiry }, settings.secret);
    },
    verify: token => {
      return jwt.verify(token, settings.secret);
    }
  };

};
