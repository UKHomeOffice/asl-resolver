try {
  // eslint-disable-next-line
  require('dotenv/config');
} catch (e) { /* do nothing */ }

const path = require('path');
const db = require('@asl/schema');
const StatsD = require('hot-shots');
const statsd = new StatsD();

const args = require('minimist')(process.argv.slice(2));
const task = args._[0];

const settings = require('../config');
const Logger = require('../lib/utils/logger');
const logger = Logger(settings);

const run = fn => {
  const models = db(settings.db);
  return Promise.resolve()
    .then(() => fn({ models, logger }));
};

if (!task) {
  console.error(`Task must be defined.\n\nUsage:  npm run task -- ./tasks/file.js\n\n`);
  statsd.increment('asl.task.error', 1);
  process.exit(1);
}

Promise.resolve()
  .then(() => {
    return require(path.resolve(process.cwd(), task));
  })
  .then(fn => {
    return run(fn);
  })
  .then(() => {
    process.exit(0);
  })
  .catch(e => {
    logger.error({ message: e.message, stack: e.stack, ...e });
    statsd.increment('asl.task.error', 1);
    process.exit(1);
  });
