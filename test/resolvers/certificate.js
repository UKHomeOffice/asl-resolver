const assert = require('assert');
const { certificate } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const id = uuid();
const profileId = uuid();

describe('Certificate resolver', () => {
  before(() => {
    this.models = db.init();
    this.certificate = certificate({ models: this.models });
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
      return this.certificate({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a certificate model', () => {
      const opts = {
        action: 'create',
        data: {
          profileId,
          modules: [ 'PILB' ],
          species: ['mice']
        }
      };
      return Promise.resolve()
        .then(() => this.certificate(opts))
        .then(() => this.models.Certificate.query().where({ profileId }))
        .then(certificates => certificates[0])
        .then(certificate => {
          assert.ok(certificate);
          assert.deepEqual(certificate.modules, opts.data.modules);
          assert.deepEqual(certificate.species, opts.data.species);
        });
    });

  });

  describe('Delete', () => {

    beforeEach(() => {
      return this.models.Certificate.query().insert({
        id,
        profileId,
        modules: [ 'PILB' ],
        species: ['mice']
      });
    });

    it('soft deletes the model', () => {
      const opts = {
        action: 'delete',
        id
      };
      return Promise.resolve()
        .then(() => this.certificate(opts))
        .then(() => this.models.Certificate.query().findById(opts.id))
        .then(certificate => {
          assert.deepEqual(certificate, undefined);
        })
        .then(() => this.models.Certificate.queryWithDeleted().findById(opts.id))
        .then(certificate => {
          assert(certificate.deleted);
        });
    });

  });
});
