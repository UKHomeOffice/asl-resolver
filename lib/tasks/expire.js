const moment = require('moment');

module.exports = ({ Project }) => () => {
  return Project.query()
    .update({ status: 'expired' })
    .where('expiryDate', '<=', moment().toISOString())
    .where('status', '!=', 'expired');
};
