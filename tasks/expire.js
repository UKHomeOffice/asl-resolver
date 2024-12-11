const moment = require('moment');

function expireModels(Model, beforeTime, knex) {
  return Model.query(knex)
    .patch({ status: 'expired' })
    .where('expiryDate', '<', beforeTime)
    .where('status', 'active')
    .returning('*');
}

const expire = async ({ models, logger }, knex) => {
  const { Project, TrainingPil } = models;
  const midnightLastNight = moment.utc().startOf('day').toISOString();
  logger.info(`performing project and cat e pil expiry check with cutoff of ${midnightLastNight}`);

  function reportExpiry(models, modelName) {
    if (models.length > 0) {
      models.forEach(item => {
        logger.info(`expired ${modelName} ${item.licenceNumber}`);
      });
    } else {
      logger.info(`no ${modelName}s found to expire`);
    }
  }

  return Promise.all([
    expireModels(Project, midnightLastNight, knex),
    expireModels(TrainingPil, midnightLastNight, knex)
  ]).then(([projects, trainingPils]) => {
    reportExpiry(projects, 'project');
    reportExpiry(trainingPils, 'trainingPil');
  });
};

module.exports = expire;
