const assert = require('assert');
const moment = require('moment');
const { establishment } = require('../../lib/resolvers');
const db = require('../helpers/db');

describe('Establishment resolver', () => {
  before(() => {
    this.models = db.init();
    this.establishment = establishment({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.establishment({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert an establishment', () => {
      const opts = {
        action: 'create',
        data: {
          name: 'New establishment'
        }
      };
      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Establishment.query())
        .then(establishments => establishments[0])
        .then(establishment => {
          assert.ok(establishment);
          assert.deepEqual(establishment.name, opts.data.name);
          assert.deepEqual(establishment.status, 'inactive');
        });
    });
  });

  describe('Grant', () => {
    it('can grant a licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'inactive'
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'grant',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query())
            .then(establishments => establishments[0])
            .then(establishment => {
              assert.ok(establishment.licenceNumber, 'has a generated licence number');
              assert.deepEqual(establishment.status, 'active', 'status has been changed to active');
              assert(establishment.issueDate, 'has an issue date');
              assert(moment(establishment.issueDate).isValid(), 'issue date is a valid date');
            });
        });
    });
  });

  describe('Revoke', () => {
    it('can revoke an establishment licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'active'
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'revoke',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query())
            .then(establishments => establishments[0])
            .then(establishment => {
              assert.deepEqual(establishment.status, 'revoked', 'status has been changed to revoked');
              assert(establishment.revocationDate, 'has a revocation date');
              assert(moment(establishment.revocationDate).isValid(), 'revocation date is a valid date');
            });
        });
    });

  });

});
