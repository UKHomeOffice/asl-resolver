const assert = require('assert');
const { procedure } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const profileId = uuid();
const projectId = uuid();
const ropId = uuid();
const establishmentId = 100;

describe('Procedure resolver', () => {
  before(() => {
    this.models = db.init();
    this.procedure = procedure({ models: this.models });
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
      }))
      .then(() => this.models.Rop.query().insert({
        id: ropId,
        projectId,
        year: 2021
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  describe('Create', () => {
    it('can insert multiple procedure models', () => {
      const opts = {
        action: 'create',
        data: [
          {
            ropId,
            species: 'mice',
            reuse: true,
            ga: 'no-ga',
            purposes: 'basic',
            newGeneticLine: false,
            basicSubpurposes: 'other',
            severity: 'non',
            severityNum: 123
          },
          {
            ropId,
            species: 'mice',
            reuse: true,
            ga: 'no-ga',
            purposes: 'basic',
            newGeneticLine: false,
            basicSubpurposes: 'other',
            severity: 'severe',
            severityNum: 456
          }
        ]
      };
      return Promise.resolve()
        .then(() => this.procedure(opts))
        .then(() => this.models.Procedure.query().where({ ropId }))
        .then(procedures => {
          assert.equal(procedures.length, 2);
          assert.equal(procedures[0].species, 'mice');
          assert.equal(procedures[0].severityNum, 123);
          assert.equal(procedures[1].severityNum, 456);
        });
    });

  });
});
