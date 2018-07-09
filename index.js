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

app.start();
