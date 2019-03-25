const moment = require('moment');

module.exports = ({ Project }) => {
  const expireProjects = () => Project.query()
    .update({ status: 'expired' })
    .where('expiryDate', '<=', moment().toISOString())
    .where('status', '!=', 'expired');

  setInterval(() => expireProjects(), 1000);
};
