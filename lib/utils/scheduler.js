const moment = require('moment');

module.exports = (interval = 'day') => {

  let lastCall;
  const tasks = [];

  setInterval(() => {
    if (lastCall && lastCall.isBefore(moment(), interval)) {
      tasks.forEach(task => task());
      lastCall = moment();
    }
  }, 60 * 1000);

  return fn => {
    if (typeof fn !== 'function') {
      throw new Error('Scheduled tasks must be a function.');
    }
    tasks.push(fn);
  };

};
