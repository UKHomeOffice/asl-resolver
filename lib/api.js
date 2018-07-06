const api = require('@asl/service/api');
const db = require('@asl/schema');

const resolvers = require('./resolvers');

module.exports = settings => {
  const app = api(settings);

  const models = db(settings.db);

  app.post('/', (req, res, next) => {
    if (!req.body.model || !resolvers[req.body.model]) {
      throw new Error(`Unknown model type: ${req.body.model}`);
    }
    resolvers[req.body.model](models, req.body)
      .then(() => res.json({}))
      .catch(e => next(e));
  });

  app.use((err, req, res, next) => {
    res.status(500);
    req.log('error', req.body);
    req.log('error', err);
    res.json({
      message: err.message,
      stack: err.stack
    });
  });

  return app;

};
