const moment = require('moment');

module.exports = ({ Project }, logger) => async () => {
  const midnightLastNight = moment.utc().startOf('day').toISOString();
  logger.info(`performing project expiry check with cutoff of ${midnightLastNight}`);

  await Project.query()
    .patch({ status: 'expired' })
    .where('expiryDate', '<', midnightLastNight)
    .where('status', 'active')
    .returning('*')
    .then(projects => {
      if (projects.length > 0) {
        projects.map(project => {
          logger.info(`expired project ${project.licenceNumber}`);
        });
      } else {
        logger.info('no projects found to expire');
      }
    });
};
