const sinon = require('sinon');

module.exports = {
  sign: sinon.stub().resolves('A TOKEN'),
  verify: sinon.stub()
};
