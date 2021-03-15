const Schema = require('@asl/schema');
const settings = require('@asl/schema/knexfile').test;

const tables = [
  'Changelog',
  'EmailPreferences',
  'TrainingPil',
  'TrainingCourse',
  'ProjectEstablishment',
  'ProjectProfile',
  'RetrospectiveAssessment',
  'Procedure',
  'Rop',
  'ProjectVersion',
  'Project',
  'Invitation',
  'Permission',
  'Authorisation',
  'PilTransfer',
  'FeeWaiver',
  'PIL',
  'PlaceRole',
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
      return p.then(() => {
        if (schema[table].queryWithDeleted) {
          return schema[table].queryWithDeleted().hardDelete();
        }
        return schema[table].query().delete();
      });
    }, Promise.resolve());
  }
};
