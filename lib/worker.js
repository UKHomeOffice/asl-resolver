const db = require('@asl/schema');

const resolvers = require('./resolvers');

module.exports = settings => {

  const models = db(settings.db);

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
        return resolvers[body.model](models, body);
      })
      .then(() => done())
      .catch(e => {
        console.log(e);
        done(e);
      });

  };

};
