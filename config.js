module.exports = {
  logLevel: process.env.LOG_LEVEL || 'info',
  sqs: {
    region: process.env.SQS_REGION,
    accessKey: process.env.SQS_ACCESS_KEY,
    secret: process.env.SQS_SECRET,
    url: process.env.SQS_URL
  },
  s3: {
    region: process.env.S3_REGION,
    accessKey: process.env.S3_ACCESS_KEY,
    secret: process.env.S3_SECRET,
    bucket: process.env.S3_BUCKET,
    transportKey: process.env.TRANSPORT_KEY,
    transportIV: process.env.TRANSPORT_IV,
    localstackUrl: process.env.S3_LOCALSTACK_URL
  },
  db: {
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
    password: process.env.DATABASE_PASSWORD,
    port: process.env.DATABASE_PORT,
    username: process.env.DATABASE_USERNAME || 'postgres'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || '7 days'
  },
  emailer: {
    host: process.env.EMAILER_SERVICE,
    registerService: process.env.REGISTER_SERVICE
  },
  auth: {
    realm: process.env.KEYCLOAK_REALM,
    url: process.env.KEYCLOAK_URL,
    client: process.env.KEYCLOAK_CLIENT,
    secret: process.env.KEYCLOAK_SECRET,
    adminUsername: process.env.KEYCLOAK_USERNAME,
    adminPassword: process.env.KEYCLOAK_PASSWORD
  }
};
