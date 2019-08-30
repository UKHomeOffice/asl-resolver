const moment = require('moment');

module.exports = ({ Project }) => async () => {
  const midnightLastNight = moment.utc().startOf('day').toISOString();
  console.log(`performing expiry check with cutoff of ${midnightLastNight}`);

  await Project.query()
    .patch({ status: 'expired' })
    .where('expiryDate', '<', midnightLastNight)
    .where('status', 'active')
    .returning('*')
    .then(projects => {
      if (projects.length > 0) {
        projects.map(project => {
          console.log(`expired project ${project.licenceNumber}`);
        });
      } else {
        console.log('no projects found to expire');
      }
    });
};
