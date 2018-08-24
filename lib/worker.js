const db = require('@asl/schema');

const Keycloak = require('./keycloak');
const JWT = require('./jwt');
const Emailer = require('./emailer');
const resolvers = require('./resolvers');

module.exports = settings => {

  const models = db(settings.db);
  const keycloak = Keycloak(settings.auth);
  const jwt = JWT(settings.jwt);
  const emailer = Emailer(settings.emailer);

  return (message, done) => {

    Promise.resolve()
      .then(() => {
        return JSON.parse(message.Body);
      })
      .then(body => {
        if (!body.model || !resolvers[body.model]) {
          throw new Error(`Unknown model type: ${body.model}`);
        }
        return body;
      })
      .then(body => {
        console.log(body);
        return resolvers[body.model]({ models, keycloak, jwt, emailer })(body);
      })
      .then(() => done())
      .catch(e => {
        console.log(e);
        done(e);
      });

  };

};
