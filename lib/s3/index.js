const crypto = require('crypto');
const AWS = require('aws-sdk');

module.exports = (settings, logger) => {
  const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: settings.region,
    accessKeyId: settings.accessKey,
    secretAccessKey: settings.secret
  });

  return key => {
    logger.verbose(`Fetching message with key: ${key} from s3`);
    const params = {
      Key: key,
      Bucket: settings.bucket
    };
    return Promise.resolve()
      .then(() => {
        return new Promise((resolve, reject) => {
          s3.getObject(params, (err, data) => {
            return err ? reject(err) : resolve(JSON.parse(data.Body.toString('utf8')));
          });
        });
      })
      .then(data => {
        logger.verbose(`Message with key: ${key} retrieved`);
        // don't wait for delete before returning data
        Promise.resolve()
          .then(() => {
            return new Promise((resolve, reject) => {
              s3.deleteObject(params, err => {
                return err ? reject(err) : resolve();
              });
            });
          })
          .then(() => logger.verbose(`Key: ${key} removed from bucket`));
        return data;
      })
      .then(data => {
        const decipher = crypto.createDecipheriv('aes-256-cbc', settings.transportKey, settings.transportIV);
        const result = decipher.update(data.payload, 'base64', 'utf8') + decipher.final('utf8');
        return JSON.parse(result);
      });
  };
};
