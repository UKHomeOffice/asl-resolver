const moment = require('moment');

module.exports = (interval = 'minute') => {
  let lastCall;
  const tasks = [];
  const aMinute = 60 * 1000; // also minimum interval

  setInterval(() => {
    const now = moment();
    // will run once a minute after starting and then again each interval
    if (!lastCall || lastCall.isBefore(now, interval)) {
      tasks.forEach(task => task());
      lastCall = moment();
    }
  }, aMinute);

  return fn => {
    if (typeof fn !== 'function') {
      throw new Error('Scheduled tasks must be a function.');
    }
    tasks.push(fn);
  };

};
