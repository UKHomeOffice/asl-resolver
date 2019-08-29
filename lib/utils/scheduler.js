const moment = require('moment');

module.exports = (interval = 'minute') => {
  let lastCall;
  const tasks = [];

  setInterval(() => {
    const now = moment();
    if (!lastCall || lastCall.isBefore(now, interval)) {
      tasks.forEach(task => task());
      lastCall = moment();
    }
  }, 60 * 1000); // minimum interval is 1 minute

  return fn => {
    if (typeof fn !== 'function') {
      throw new Error('Scheduled tasks must be a function.');
    }
    tasks.push(fn);
  };

};
