const assert = require('assert');
const moment = require('moment');
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
          projectId,
          year: 2021
        }
      };
      return Promise.resolve()
        .then(() => this.rop(opts))
        .then(() => this.models.Rop.query().where({ projectId }))
        .then(rops => rops[0])
        .then(rop => {
          assert.ok(rop);
          assert.deepStrictEqual(rop.year, 2021);
        });
    });

    it('can submit a rop', () => {
      const now = moment();
      const ropId = uuid();

      const opts = {
        action: 'submit',
        id: ropId
      };

      return Promise.resolve()
        .then(() => this.models.Rop.query().insert({
          id: ropId,
          projectId,
          year: 2021,
          status: 'draft'
        }))
        .then(() => this.rop(opts))
        .then(() => this.models.Rop.query().findById(ropId))
        .then(rop => {
          assert.ok(rop);
          assert.deepStrictEqual(rop.status, 'submitted', 'status should be updated to submitted');
          assert.ok(rop.submittedDate, 'submitted date should be set');
          assert.ok(moment(rop.submittedDate).isSameOrAfter(now), 'submitted date should be now or thereabouts');
        });
    });

  });
});
