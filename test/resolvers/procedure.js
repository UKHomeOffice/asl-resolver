const assert = require('assert');
const { procedure } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const profileId = uuid();
const projectId = uuid();
const ropId = uuid();
const establishmentId = 100;

describe('Procedure resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.procedure = procedure({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert({
        id: establishmentId,
        name: 'Uni of Croy'
      });

   await models.Profile.query(knexInstance).insert({
        id: profileId,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterline@archer.com'
      });

   await models.Project.query(knexInstance).insert({
        id: projectId,
        establishmentId,
        title: 'Test proj',
        licenceHolder: profileId
      });

   await models.Rop.query(knexInstance).insert({
        id: ropId,
        projectId,
        year: 2021
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('Create', () => {
    it('can insert multiple procedure models', async () => {
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

      transaction = await knexInstance.transaction();
      await this.procedure(opts, transaction);
      transaction.commit();

      const procedures = await models.Procedure.query(knexInstance).where({ ropId });
      assert.equal(procedures.length, 2);
      assert.equal(procedures[0].species, 'mice');
      assert.equal(procedures[0].severityNum, 123);
      assert.equal(procedures[1].severityNum, 456);
    });
  });
});
