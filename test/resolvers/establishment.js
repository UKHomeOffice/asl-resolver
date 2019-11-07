const assert = require('assert');
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

});
