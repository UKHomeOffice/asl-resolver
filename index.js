const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const config = require('./config');

const Logger = require('./lib/utils/logger');

const logger = Logger(config);

const handleMessage = require('./lib/worker')({ ...config, logger });

const sqs = new AWS.SQS({
  region: config.sqs.region,
  accessKeyId: config.sqs.accessKey,
  secretAccessKey: config.sqs.secret
});

const app = Consumer.create({
  queueUrl: config.sqs.url,
  handleMessage,
  batchSize: 10,
  sqs
});

app.on('error', error => {
  logger.error(error.message);
  app.stop();
  setTimeout(() => app.start(), 1000);
});

app.start();

logger.info(`Listening to queue at ${config.sqs.url}`);
