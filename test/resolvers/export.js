const assert = require('assert');
const uuid = require('uuid/v4');
const resolver = require('../../lib/resolvers/export');
const db = require('../helpers/db');

const PROFILE_ID = uuid();

describe('Export resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.resolver = resolver({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Profile.query(knexInstance).insert([
      {
        id: PROFILE_ID,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterling@archer.com',
        telephone: '01234567890',
        dob: '1979-12-01',
        asruUser: true
      }
    ]);
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('create', () => {

    it('adds a pending Export record', async () => {
      const params = {
        action: 'create',
        data: {
          type: 'rops',
          key: '2021',
          profileId: PROFILE_ID
        }
      };

      transaction = await knexInstance.transaction();
      await this.resolver(params, transaction);
      await transaction.commit();

      const results = await models.Export.query(knexInstance);

      assert.equal(results.length, 1);
      assert.equal(results[0].type, 'rops');
      assert.equal(results[0].key, '2021');
      assert.equal(results[0].profileId, PROFILE_ID);
      assert.equal(results[0].ready, false);
    });
  });

  describe('delete', () => {

    beforeEach(async () => {
      this.id = uuid();
      await models.Export.query(knexInstance).insert({ id: this.id, type: 'rops', key: '2021', profileId: PROFILE_ID });
    });

    it('throws', () => {
      const params = {
        action: 'delete',
        id: this.id
      };
      return assert.rejects(() => this.resolver(params));
    });
  });

  describe('update', () => {

    beforeEach(() => {
      this.id = uuid();
      return this.models.Export.query().insert({ id: this.id, type: 'rops', key: '2021', profileId: PROFILE_ID });
    });

    it('throws', () => {
      const params = {
        action: 'update',
        id: this.id,
        data: {
          type: 'rops',
          key: '2022',
          profileId: PROFILE_ID
        }
      };
      return assert.rejects(() => this.resolver(params));
    });
  });

});
