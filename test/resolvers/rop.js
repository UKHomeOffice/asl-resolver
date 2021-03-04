const assert = require('assert');
const { rop } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const profileId = uuid();
const projectId = uuid();
const establishmentId = 100;

describe('ROP resolver', () => {
  before(() => {
    this.models = db.init();
    this.rop = rop({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert({
        id: establishmentId,
        name: 'Uni of Croy'
      }))
      .then(() => this.models.Profile.query().insert({
        id: profileId,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterline@archer.com'
      }))
      .then(() => this.models.Project.query().insert({
        id: projectId,
        establishmentId,
        title: 'Test proj',
        licenceHolder: profileId
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  describe('Create', () => {
    it('can insert a rop model', () => {
      const opts = {
        action: 'create',
        data: {
          projectId
        }
      };
      return Promise.resolve()
        .then(() => this.rop(opts))
        .then(() => this.models.Rop.query().where({ projectId }))
        .then(rops => rops[0])
        .then(rop => {
          assert.ok(rop);
          assert.deepEqual(rop.year, 2021);
        });
    });

  });
});
