const uuid = require('uuid/v4');
const { omit } = require('lodash');

module.exports = (version = {}) => {
  if (!version.data) {
    return version;
  }

  // strip additional availability and transfer info
  version.data.establishments = (version.data.establishments || []).map(est => omit(est, 'establishment-id', 'name'));
  version.data.transferToEstablishment = null;
  version.data.transferToEstablishmentName = null;

  if (!version.data.protocols) {
    return version;
  }
  version.data.protocols.forEach(protocol => {
    if (!protocol.speciesDetails) {
      return;
    }
    protocol.speciesDetails.forEach(species => {
      species.id = species.id || uuid();
    });
  });

  return version;
};
