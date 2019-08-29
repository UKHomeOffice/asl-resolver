const moment = require('moment');

module.exports = ({ Project }) => async () => {
  await Project.query()
    .patch({ status: 'expired' })
    .where('expiryDate', '<=', moment().startOf('day').toISOString())
    .where('status', 'active');
};
