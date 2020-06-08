const { castArray } = require('lodash');

module.exports = Changelog => {
  return {

    log: (messageId, body, changelog, transaction) => {
      let establishmentId = body.establishmentId || (body.data && body.data.establishmentId) || null;

      if (establishmentId) {
        establishmentId = establishmentId.toString();
      }

      const changes = castArray(changelog).map(item => {
        const state = item.state || item;
        return {
          establishmentId,
          messageId,
          changedBy: state.changedBy || body.changedBy,
          modelId: state.id ? state.id.toString() : null,
          modelType: item.model || body.model,
          action: body.action,
          state
        };
      });

      return Changelog.query(transaction).insert(changes);
    },

    logError: (messageId, body = {}, error) => {
      let establishmentId = body.establishmentId || (body.data && body.data.establishmentId) || null;

      if (establishmentId) {
        establishmentId = establishmentId.toString();
      }

      let changedBy = body.changedBy;

      if (body.model === 'profile') {
        changedBy = body.id;
      }

      const changes = {
        establishmentId,
        messageId,
        changedBy,
        modelId: body.id ? body.id.toString() : null,
        modelType: body.model || 'error',
        action: 'error',
        state: error
      };

      return Changelog.query().insert(changes);
    }
  };
};
