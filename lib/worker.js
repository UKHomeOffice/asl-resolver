const { castArray } = require('lodash');
const db = require('@asl/schema');

const JWT = require('./jwt');
const Emailer = require('./emailer');
const resolvers = require('./resolvers');

module.exports = settings => {

  const models = db(settings.db);
  const jwt = JWT(settings.jwt);
  const emailer = Emailer(settings.emailer);

  return (message, done) => {

    Promise.resolve()
      .then(() => {
        return JSON.parse(message.Body);
      })
      .then(body => {
        return Promise.resolve()
          .then(() => {
            if (!body.model || !resolvers[body.model]) {
              throw new Error(`Unknown model type: ${body.model}`);
            }
          })
          .then(() => {
            console.log(body);
            return resolvers[body.model]({ models, jwt, emailer })(body);
          })
          .then(changelog => {

            let establishmentId = body.establishmentId || (body.data && body.data.establishmentId) || null;

            if (establishmentId) {
              establishmentId = establishmentId.toString();
            }

            const changes = castArray(changelog).map(item => {
              const state = item.state || item;
              return {
                establishmentId,
                messageId: message.MessageId,
                changedBy: state.changedBy || body.changedBy,
                modelId: state.id ? state.id.toString() : null,
                modelType: item.model || body.model,
                action: body.action,
                state
              };
            });

            return models.Changelog.query().insert(changes);
          });
      })
      .then(() => done())
      .catch(e => {
        console.error(e);
        done();
      });

  };

};
