const uuid = require('uuid/v4');

module.exports = (version = {}) => {
  if (!version.data) {
    return version;
  }

  // strip additional availability and transfer info
  version.data.establishments = [];
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
