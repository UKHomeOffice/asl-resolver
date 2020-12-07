const generateLicenceNumber = require('./generate-licence-number');
const normaliseProjectVersion = require('./normalise-project-version');
const retrospectiveAssessment = require('./retrospective-assessment');
const getSpecies = require('./extract-species');

module.exports = {
  generateLicenceNumber,
  normaliseProjectVersion,
  retrospectiveAssessment,
  getSpecies
};
