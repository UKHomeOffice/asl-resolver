const { uniq, flatten, compact } = require('lodash');
const { projectSpecies } = require('@ukhomeoffice/asl-constants');

const species = flatten(Object.values(projectSpecies));

const legacy = {
  '2': 'Amphibians',
  '3': 'Animals taken from the wild',
  '4': 'Avian Eggs',
  '5': 'Birds',
  '6': 'Camelids',
  '7': 'Cats',
  '8': 'Cattle',
  '9': 'Cephalopods',
  '10': 'Deer',
  '11': 'Dogs',
  '12': 'Ferrets',
  '14': 'Fish - all other fish',
  '13': 'Fish - Zebra Fish',
  '15': 'Gerbils',
  '29': 'Goats',
  '16': 'Goats, sheep',
  '17': 'Guinea-pigs',
  '18': 'Hamsters',
  '19': 'Horses',
  '20': 'Mice',
  '1': 'N/A',
  '21': 'Non-human primates - new world (e.g. marmosets)',
  '22': 'Non-human primates - old world (e.g. macaques)',
  '28': 'Other species',
  '23': 'Pigs',
  '24': 'Rabbits',
  '25': 'Rats',
  '26': 'Reptiles',
  '27': 'Seals',
  '30': 'Sheep'
};

function extract(data) {
  const fields = [
    'species',
    'species-other',
    'species-other-amphibians',
    'species-other-birds',
    'species-other-camelids',
    'species-other-dogs',
    'species-other-domestic-fowl',
    'species-other-equidae',
    'species-other-fish',
    'species-other-nhps',
    'species-other-reptiles',
    'species-other-rodents'
  ];

  return fields
    .reduce((list, key) => {
      return [...list, ...(data[key] || [])];
    }, [])
    .filter(s => !s.match(/^other-/))
    .map(s => {
      const coded = species.find(sp => sp.value === s);
      return coded ? coded.label : s;
    });
}

const extractLegacy = data => {
  const protocols = data.protocols || [];
  return protocols
    .reduce((list, protocol) => {
      return [...list, ...(protocol.species || [])];
    }, [])
    .map(s => {
      if (s.speciesId === '28') {
        return s['other-species-type'];
      }
      return legacy[s.speciesId];
    });
};

function getSpecies(data, { schemaVersion, id } = {}) {
  try {
    if (schemaVersion === 0) {
      return compact(uniq(extractLegacy(data)));
    }
    return compact(uniq(extract(data)));
  } catch (e) {
    console.error(`Failed to extract species from project ${id}`);
    console.error(e.stack);
    return [];
  }
}

module.exports = getSpecies;
