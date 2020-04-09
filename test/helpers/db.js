const Schema = require('@asl/schema');
const settings = require('@asl/schema/knexfile').test;

const tables = [
  'Changelog',
  'ProjectProfile',
  'ProjectVersion',
  'Project',
  'Invitation',
  'Permission',
  'Authorisation',
  'PilTransfer',
  'FeeWaiver',
  'PIL',
  'Place',
  'Role',
  'Certificate',
  'Exemption',
  'AsruEstablishment',
  'Profile',
  'Establishment'
];

module.exports = {
  init: () => Schema(settings.connection),
  clean: schema => {
    return tables.reduce((p, table) => {
      return p.then(() => schema[table].queryWithDeleted().hardDelete());
    }, Promise.resolve());
  }
};
