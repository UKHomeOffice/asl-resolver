const { performance } = require('perf_hooks');
const { mapValues, pick } = require('lodash');
const db = require('@asl/schema');
const StatsD = require('hot-shots');

const JWT = require('./jwt');
const Emailer = require('./emailer');
const Resolvers = require('./resolvers');
const Changelog = require('./changelog');
const S3 = require('./s3');
const Keycloak = require('./keycloak');

module.exports = settings => {

  const logger = settings.logger;
  const statsd = new StatsD();

  const models = db(settings.db);
  const jwt = JWT(settings.jwt);
  const emailer = Emailer(settings.emailer, logger);
  const getMessage = S3(settings.s3, logger);
  const keycloak = Keycloak(settings.auth);

  const resolvers = mapValues(Resolvers, resolver => resolver({ models, jwt, emailer, keycloak, logger }));

  const changelog = Changelog(models.Changelog);

  return (message) => {
    const start = performance.now();
    return Promise.resolve()
      .then(() => {
        return JSON.parse(message.Body);
      })
      .then(data => getMessage(data.key))
      .then(body => {
        message.body = pick(body, 'model', 'action', 'id', 'changedBy');
        if (!body.model || !resolvers[body.model]) {
          throw new Error(`Unknown model type: ${body.model}`);
        }
        settings.logger.info('Received message', message.body);
        const resolver = resolvers[body.model];
        return models.transaction()
          .then(transaction => {
            return resolver(body, transaction)
              .then(changes => changelog.log(message.MessageId, body, changes, transaction))
              .then(() => transaction.commit())
              .catch(async e => {
                await transaction.rollback();
                throw e;
              });
          });
      })
      // send a zero error metric
      .then(() => statsd.increment('asl-resolver.error', 0))
      .then(() => {
        const time = performance.now() - start;
        statsd.timing('asl-resolver.processTime', time);
        statsd.increment('asl-resolver.processed', 1);
        settings.logger.info('Processed message', { ...message.body, time });
      })
      .catch(e => {
        return Promise.resolve()
          .then(() => {
            const err = {
              ...e,
              message: e.message,
              stack: e.stack,
              ...message.body
            };
            settings.logger.error(err);
            statsd.increment('asl-resolver.error');
            return changelog.logError(message.MessageId, message.body, err);
          })
          .catch(e => {
            settings.logger.error({ ...e, message: e.message, stack: e.stack });
          });
      });

  };

};
