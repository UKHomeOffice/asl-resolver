const moment = require('moment');

function expireModels(Model, beforeTime) {
  return Model.query()
    .patch({ status: 'expired' })
    .where('expiryDate', '<', beforeTime)
    .where('status', 'active')
    .returning('*');
}

const expire = ({ models, logger }) => {
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
    expireModels(Project, midnightLastNight),
    expireModels(TrainingPil, midnightLastNight)
  ]).then(([projects, trainingPils]) => {
    reportExpiry(projects, 'project');
    reportExpiry(trainingPils, 'trainingPil');
  });
};

module.exports = expire;
