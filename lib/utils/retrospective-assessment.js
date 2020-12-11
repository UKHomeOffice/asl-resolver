const {
  intersection,
  values,
  flatten,
  isUndefined,
  isPlainObject
} = require('lodash');
const { projectSpecies } = require('@asl/constants');

const species = flatten(values(projectSpecies));

const nopes = [
  // legacy
  'prosimians',
  'marmosets',
  'cynomolgus',
  'rhesus',
  // legacy
  'vervets',
  // legacy
  'baboons',
  // legacy
  'squirrel-monkeys',
  // legacy
  'other-old-world',
  // legacy
  'other-new-world',
  'other-nhps',
  // legacy
  'apes',
  'beagles',
  'other-dogs',
  'cats',
  'horses'
];

function isRequired(project) {
  if (!project) {
    return false;
  }
  const hasRASpecies = !!intersection(project.species, nopes).length;
  const hasRASpeciesOther = !!intersection(project['species-other'], nopes.map(n => (species.find(s => s.value === n) || {}).label)).length;
  const hasEndangeredAnimals = project['endangered-animals'];
  const hasSevereProtocols = (project.protocols || []).filter(p => p && !p.deleted).some(p => (p.severity || '').match(/severe/ig));
  const isTrainingLicence = project['training-licence'];
  return hasRASpecies || hasRASpeciesOther || hasEndangeredAnimals || hasSevereProtocols || isTrainingLicence;
}

function addedByAsru(project) {
  if (!project) {
    return false;
  }
  if (!isUndefined(project.retrospectiveAssessment)) {
    // legacy licences may have an object containing a boolean/
    if (isPlainObject(project.retrospectiveAssessment)) {
      return !!project.retrospectiveAssessment['retrospective-assessment-required'];
    }
    // now saved as a boolean
    return !!project.retrospectiveAssessment;
  }
  // previous new licences contained a 'retrospective-assessment' condition.
  if (project.conditions && project.conditions.find(c => c.key === 'retrospective-assessment')) {
    return true;
  }
  return false;
}

module.exports = {
  isRequired,
  addedByAsru
};
