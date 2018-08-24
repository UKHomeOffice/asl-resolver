const sinon = require('sinon');

module.exports = {
  ensureUser: sinon.stub().resolves({ id: '345b1f16-1f00-49f7-bf47-6fdf237ca73f' }),
  setUserPassword: sinon.stub().resolves()
};
