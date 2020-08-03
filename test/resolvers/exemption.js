const assert = require('assert');
const { exemption } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const id = uuid();
const profileId = uuid();

describe('Exemption resolver', () => {
  before(() => {
    this.models = db.init();
    this.exemption = exemption({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert({
        id: profileId,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterline@archer.com'
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.exemption({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a exemption model', () => {
      const opts = {
        action: 'create',
        data: {
          profileId,
          module: 'PILB',
          species: ['mice']
        }
      };
      return Promise.resolve()
        .then(() => this.exemption(opts))
        .then(() => this.models.Exemption.query().where({ profileId }))
        .then(exemptions => exemptions[0])
        .then(exemption => {
          assert.ok(exemption);
          assert.deepEqual(exemption.module, opts.data.module);
          assert.deepEqual(exemption.species, opts.data.species);
        });
    });

  });

  describe('Delete', () => {

    beforeEach(() => {
      return this.models.Exemption.query().insert({
        id,
        profileId,
        module: 'PILB',
        species: ['mice']
      });
    });

    it('soft deletes the model', () => {
      const opts = {
        action: 'delete',
        id
      };
      return Promise.resolve()
        .then(() => this.exemption(opts))
        .then(() => this.models.Exemption.query().findById(opts.id))
        .then(exemption => {
          assert.deepEqual(exemption, undefined);
        })
        .then(() => this.models.Exemption.queryWithDeleted().findById(opts.id))
        .then(exemption => {
          assert(exemption.deleted);
        });
    });

  });
});
