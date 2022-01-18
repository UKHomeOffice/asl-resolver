# asl-resolver

## About

Worker module that consumes change-request messages from SQS queue and resolves them back into the database

## Usage

To run a local instance:

```
npm run dev
```

Messages can also be injected directly for development without invoking SQS. See [Injection](#injection)

## Dependencies

* `@asl/schema` provides models for interacting with database objects

## Configuration

The service can be configured for local development by setting environment variables in a `.env` file.

The following environment variables are required:

* `DATABASE_NAME` - the name of your postgres database
* `KEYCLOAK_REALM` - the keycloak realm used for authentication
* `KEYCLOAK_URL` - the url of the keycloak server
* `KEYCLOAK_CLIENT` - the client name used to authenticate with keycloak
* `KEYCLOAK_SECRET` - the secret used to authenticate with the keycloak client
* `KEYCLOAK_USERNAME` - administrator username to authenticate with the keycloak client
* `KEYCLOAK_PASSWORD` - administrator password used to authenticate with the keycloak client
* `SQS_REGION` - the region of the SQS instance to consume from
* `SQS_ACCESS_KEY` - access key used to consume SQS
* `SQS_SECRET` - secret used to consume SQS
* `SQS_URL` - endpoint for SQS
* `S3_REGION` - the region of the S3 instance to query
* `S3_ACCESS_KEY` - access key used to query S3
* `S3_SECRET` - secret used to query S3
* `S3_BUCKET` - the S3 bucket name
* `S3_LOCALSTACK_URL` - the URL for the localstack s3 instance (dev only)
* `JWT_SECRET` - arbitrary string used to sign JWT tokens for invitations
* `EMAILER_SERVICE` - url of `asl-emailer` instance used to send invitations
* `REGISTER_SERVICE` - url of `asl-register` instance used to accept invitations
* `TRANSPORT_KEY` - 32 character encryption key used to encrypt messages in s3
* `TRANSPORT_IV` - 16 character IV used to encrypt messages in s3

The following environment variables can be optionally defined:

* `DATABASE_HOST` - hostname of the postgres instance - default `localhost`
* `DATABASE_PORT` - port of the postgres instance - default `5432`
* `DATABASE_USERNAME` - username of the postgres instance - default `undefined`
* `DATABASE_PASSWORD` - password of the postgres instance - default `undefined`
* `JWT_EXPIRY` - expiry time for invitation links - default `7 days`
* `LOG_LEVEL` - logging level,
* `POSTGRES_PASSWORD` - default `undefined`

## Connected services

### Upstream

None. Consumes messages from SQS.

### Downstream

The following services must be available in order to run:

* `postgres` - store of licence and profile data
* `asl-emailer` - emailer service that sends invitation emails

## Development

### Database setup

Scripts for setting up a local database with dev data are available in the [`asl-schema` project](https://github.com/ukhomeoffice/asl-schema). First clone that repo and install the dependencies. Then run the following commands:

To setup the inital table schemas:

```
npm run migrate
```

To seed the database with a development dataset:

```
npm run seed
```

_Note: these scripts will require the database described by `DATABASE_NAME` to be created before they can run._

### Injection

This project comes with a CLI that allows the direct injection of messages without having to consume them from SQS.

Messages should be defined as js or json files, and passed as arguments to `bin/inject`:

```js
// user.js
module.exports = {
  model: 'invitation',
  action: 'create',
  data: {
    establishment: '8201',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Bloggs',
    role: 'admin'
  }
};
```

```bash
bin/inject user.js
```

This is equivalent to consuming a message from SQS with the same message body.
