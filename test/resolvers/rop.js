const assert = require('assert');
const moment = require('moment');
const { rop } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

const profileId = uuid();
const projectId = uuid();
const establishmentId = 100;

describe('ROP resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.rop = rop({ models });
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
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('Create', () => {
    it('can insert a rop model', async () => {
      const opts = {
        action: 'create',
        data: {
          projectId,
          year: 2021
        }
      };

      transaction = await knexInstance.transaction();
      await this.rop(opts, transaction);
      transaction.commit();

      const rops = await models.Rop.query(knexInstance).where({ projectId });
      const rop = rops[0];
      assert.ok(rop);
      assert.deepStrictEqual(rop.year, 2021);
    });

    it('can submit a rop', async () => {
      const now = moment();
      const ropId = uuid();

      const opts = {
        action: 'submit',
        id: ropId
      };

      await models.Rop.query(knexInstance).insert({
          id: ropId,
          projectId,
          year: 2021,
          status: 'draft'
        });

      transaction = await knexInstance.transaction();
      await this.rop(opts, transaction);
      transaction.commit();

      const rop = await models.Rop.query(knexInstance).findById(ropId);
      assert.ok(rop);
      assert.deepStrictEqual(rop.status, 'submitted', 'status should be updated to submitted');
      assert.ok(rop.submittedDate, 'submitted date should be set');
      assert.ok(moment(rop.submittedDate).isSameOrAfter(now), 'submitted date should be now or thereabouts');
    });

  });
});
