const moment = require('moment');

module.exports = (interval) => {
  let lastCall;
  const tasks = [];
  const aMinute = 60 * 1000; // also minimum interval

  setInterval(() => {
    const now = moment();
    // this will execute all tasks a minute after startup, and from then on once per interval
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
