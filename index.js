const Consumer = require('sqs-consumer');
const AWS = require('aws-sdk');
const config = require('./config');

const handleMessage = require('./lib/worker')(config);

const sqs = new AWS.SQS({
  region: config.sqs.region,
  accessKeyId: config.sqs.accessKey,
  secretAccessKey: config.sqs.secret
});

const app = Consumer.create({
  queueUrl: config.sqs.url,
  handleMessage,
  sqs
});

app.on('error', error => {
  console.error(error.message);
  app.stop();
  setTimeout(() => app.start(), 1000);
});

app.start();

console.log(`Listening to queue at ${config.sqs.url}`);
