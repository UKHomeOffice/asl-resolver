const { mapValues } = require('lodash');
const db = require('@asl/schema');

const JWT = require('./jwt');
const Emailer = require('./emailer');
const Resolvers = require('./resolvers');
const Changelog = require('./changelog');
const expire = require('./tasks/expire');
const Scheduler = require('./utils/scheduler');
const S3 = require('./s3');

module.exports = settings => {

  const models = db(settings.db);
  const jwt = JWT(settings.jwt);
  const emailer = Emailer(settings.emailer);
  const getMessage = S3(settings.s3);

  const resolvers = mapValues(Resolvers, resolver => resolver({ models, jwt, emailer }));

  const changelog = Changelog(models.Changelog);

  const scheduler = Scheduler('day');

  scheduler(expire(models));

  return (message, done) => {

    Promise.resolve()
      .then(() => {
        return JSON.parse(message.Body);
      })
      .then(data => getMessage(data.key))
      .then(body => {
        if (!body.model || !resolvers[body.model]) {
          throw new Error(`Unknown model type: ${body.model}`);
        }
        console.log(`Resolving: model ${body.model}, action: ${body.action}, id: ${body.model}`);
        const resolver = resolvers[body.model];
        return models.transaction()
          .then(transaction => {
            return resolver(body, transaction)
              .then(changes => changelog(message.MessageId, body, changes, transaction))
              .then(() => transaction.commit())
              .catch(async e => {
                await transaction.rollback();
                throw e;
              });
          });
      })
      .then(() => done())
      .catch(e => {
        console.error(e);
        done();
      });

  };

};
