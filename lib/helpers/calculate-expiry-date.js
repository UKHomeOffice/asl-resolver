const moment = require('moment');
const { get, isInteger } = require('lodash');

const calculateExpiryDate = (issueDate, duration) => {
    const expiryDate = issueDate ? moment(issueDate) : moment();
    const defaultDuration = { years: 5, months: 0 };

    duration.years = parseInt(get(duration, 'years'), 10);
    duration.months = parseInt(get(duration, 'months'), 10);

    duration.years =
      isInteger(duration.years) && duration.years <= 5
        ? duration.years
        : defaultDuration.years;
    duration.months =
      isInteger(duration.months) &&
      duration.years < 5 &&
      duration.months <= 11
        ? duration.months
        : defaultDuration.months;

    return expiryDate
      .add(duration)
      .subtract(1, 'days')
      .endOf('day')
      .toISOString(true);
  };

module.exports = calculateExpiryDate;
