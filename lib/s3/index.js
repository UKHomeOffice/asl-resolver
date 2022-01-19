const crypto = require('crypto');
const { S3 } = require('@asl/service/clients');

module.exports = (settings, logger) => {
  const s3Client = S3({ s3: settings });

  return key => {
    logger.verbose(`Fetching message with key: ${key} from s3`);
    const params = {
      Key: key,
      Bucket: settings.bucket
    };
    return Promise.resolve()
      .then(() => {
        return new Promise((resolve, reject) => {
          s3Client.getObject(params, (err, data) => {
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
              s3Client.deleteObject(params, err => {
                return err ? reject(err) : resolve();
              });
            });
          })
          .then(() => logger.verbose(`Key: ${key} removed from bucket`));
        return data;
      })
      .then(data => {
        // here for backwards compatibility
        // TODO remove once workflow has shipped to prod
        if (!data.secure) {
          return data;
        }
        const decipher = crypto.createDecipheriv('aes-256-cbc', settings.transportKey, settings.transportIV);
        const result = decipher.update(data.payload, 'base64', 'utf8') + decipher.final('utf8');
        return JSON.parse(result);
      });
  };
};
