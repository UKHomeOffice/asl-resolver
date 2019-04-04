const AWS = require('aws-sdk');

module.exports = settings => {
  const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: settings.region,
    accessKeyId: settings.accessKey,
    secretAccessKey: settings.secret
  });

  return key => {
    console.log(`Fetching message with key: ${key} from s3`);
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
        console.log(`Message with key: ${key} retrieved`);
        // don't wait for delete before returning data
        Promise.resolve()
          .then(() => {
            return new Promise((resolve, reject) => {
              s3.deleteObject(params, err => {
                return err ? reject(err) : resolve();
              });
            });
          })
          .then(() => console.log(`Key: ${key} removed from bucket`));
        return data;
      });
  };
};
