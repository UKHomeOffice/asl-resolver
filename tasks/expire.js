const moment = require('moment');

const expire = ({ models, logger }) => {
  const { Project } = models;
  const midnightLastNight = moment.utc().startOf('day').toISOString();
  logger.info(`performing project expiry check with cutoff of ${midnightLastNight}`);

  return Project.query()
    .patch({ status: 'expired' })
    .where('expiryDate', '<', midnightLastNight)
    .where('status', 'active')
    .returning('*')
    .then(projects => {
      if (projects.length > 0) {
        projects.forEach(project => {
          logger.info(`expired project ${project.licenceNumber}`);
        });
      } else {
        logger.info('no projects found to expire');
      }
    });
};

module.exports = expire;
