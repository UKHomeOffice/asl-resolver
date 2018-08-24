const Schema = require('@asl/schema');
const settings = require('@asl/schema/knexfile').test;

const tables = [
  'Project',
  'Invitation',
  'Permission',
  'Authorisation',
  'PIL',
  'Place',
  'Role',
  'TrainingModule',
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
