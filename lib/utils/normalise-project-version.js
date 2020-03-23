const uuid = require('uuid/v4');

module.exports = (version = {}) => {
  if (!version.data || !version.data.protocols) {
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
