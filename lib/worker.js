const db = require('@asl/schema');

const resolvers = require('./resolvers');

module.exports = settings => {

  const models = db(settings.db);

  return (message, done) => {

    const body = message.Body;
    if (!body.model || !resolvers[body.model]) {
      return done(new Error(`Unknown model type: ${body.model}`));
    }
    resolvers[body.model](models, body)
      .then(() => done())
      .catch(e => done(e));

  };

};
