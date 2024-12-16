const assert = require('assert');
const { v4: uuid } = require('uuid');
const { feeWaiver } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = uuid();
const PIL_ID = uuid();
const ASRU_ID = uuid();

describe('FeeWaiver resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.resolver = feeWaiver({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert([
        {
          id: 8201,
          name: 'Univerty of Croydon'
        }
      ]);

    await models.Profile.query(knexInstance).insertGraph({
        id: ASRU_ID,
        firstName: 'Inspector',
        lastName: 'Morse',
        email: 'asru@example.com',
        asruUser: true
      });

    await models.Profile.query(knexInstance).insertGraph({
        id: PROFILE_ID,
        firstName: 'Linford',
        lastName: 'Christie',
        email: 'test1@example.com',
        pil: {
          id: PIL_ID,
          establishmentId: 8201
        }
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('create', () => {

    it('adds a FeeWaiver record for the profile/establishment/year', async () => {
      const params = {
        action: 'create',
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          year: 2019,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      transaction = await knexInstance.transaction();
      await this.resolver(params, transaction);
      await transaction.commit();

      const results = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
      assert.equal(results.length, 1);
      assert.equal(results[0].waivedById, ASRU_ID);
      assert.equal(results[0].comment, 'Test comment');
    });

    it('adds a single record if called mutiple times with the same profile/establishment/year', async () => {
      const params = {
        action: 'create',
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          year: 2019,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      transaction = await knexInstance.transaction();
      await this.resolver(params, transaction);
      await this.resolver(params, transaction);
      await this.resolver(params, transaction);
      await transaction.commit();

      const results = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
      assert.equal(results.length, 1);
      assert.equal(results[0].establishmentId, 8201);
      assert.equal(results[0].profileId, PROFILE_ID);
      assert.equal(results[0].year, 2019);
      assert.equal(results[0].waivedById, ASRU_ID);
      assert.equal(results[0].comment, 'Test comment');
    });

  });

  describe('delete', () => {

    it('removes any existing record for the profile/establishment/year', async () => {
      const params = {
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          year: 2019,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      transaction = await knexInstance.transaction();
      await this.resolver({ ...params, action: 'create' }, transaction);
      transaction.commit();

      const resultsWithCreate = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
      assert.equal(resultsWithCreate.length, 1);

      transaction = await knexInstance.transaction();
      await this.resolver({ ...params, action: 'delete' }, transaction);
      transaction.commit();

      const resultsWithDelete = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
      assert.equal(resultsWithDelete.length, 0);
    });

    it('leaves existing record for a different year', async () => {
      const params = {
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      transaction = await knexInstance.transaction();
      params.data.year = 2018;
      await this.resolver({ ...params, action: 'create' }, transaction);
      transaction.commit();

      transaction = await knexInstance.transaction();
      params.data.year = 2019;
      await this.resolver({ ...params, action: 'create' }, transaction);
      transaction.commit();

      const resultsWithCreate2019And2019 = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201 });
      assert.equal(resultsWithCreate2019And2019.length, 2);

      transaction = await knexInstance.transaction();
      params.data.year = 2018;
      await this.resolver({ ...params, action: 'delete' }, transaction);
      transaction.commit();

      const resultWithDelete2018 = await models.FeeWaiver.query(knexInstance).where({ profileId: PROFILE_ID, establishmentId: 8201 });
      assert.equal(resultWithDelete2018[0].year, 2019);
    });

  });

});
