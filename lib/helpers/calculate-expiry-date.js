const moment = require('moment');

const calculateDuration = (inDuration) => {

  let duration = inDuration || {};

  if (inDuration) {
      duration.years = inDuration.years ? inDuration.years : (inDuration.months ? 0 : 5);
      duration.months = inDuration.months ? inDuration.months : 0;
  }

  if (duration.years >= 5 || (!duration.months && !duration.years)) {
    duration.years = 5;
    duration.months = 0;
  }

  if (duration.months > 12) {
    duration.months = 0;
  }

  return duration;
};

const calculateExpiryDate = (issueDate, duration) => {

    const expiryDate = issueDate ? moment(issueDate) : moment();
    const calculatedDuration = calculateDuration(duration);

    // Subtracting a day for license to expire 1 day before to get correct license duration
    return expiryDate
      .add(calculatedDuration)
      .subtract(1, 'days')
      .endOf('day')
      .utc(true)
      // Subtracting an hour to cater for UTC/BST
      .subtract(1, 'hour')
      .toISOString();
  };

module.exports = calculateExpiryDate;
