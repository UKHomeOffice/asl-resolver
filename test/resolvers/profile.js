const assert = require('assert');
const { profile } = require('../../lib/resolvers');
const db = require('../helpers/db');

const ID = 'e0b49357-237c-4042-b430-a57fc8e1be5f';

describe('Profile resolver', () => {
  before(() => {
    this.models = db.init();
    this.profile = profile({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert([
        {
          id: ID,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        }
      ]));
  });

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.profile({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Update', () => {
    it('can update a profile model', () => {
      const opts = {
        action: 'update',
        data: {
          firstName: 'Vincent',
          lastName: 'Malloy'
        },
        id: ID
      };
      return Promise.resolve()
        .then(() => this.profile(opts))
        .then(() => this.models.Profile.query().findById(ID))
        .then(profile => {
          assert.ok(profile);
          assert.deepEqual(profile.firstName, opts.data.firstName);
          assert.deepEqual(profile.lastName, opts.data.lastName);
        });
    });
  });
});
