const Schema = require('@asl/schema');
const settings = require('@asl/schema/knexfile').test;

const tables = [
  'Changelog',
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
  'Profile',
  'Establishment',
  'AsruEstablishment'
];

module.exports = {
  init: () => Schema(settings.connection),
  clean: schema => {
    return tables.reduce((p, table) => {
      return p.then(() => schema[table].queryWithDeleted().hardDelete());
    }, Promise.resolve());
  }
};
