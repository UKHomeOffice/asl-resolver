const { v4: uuidv4 } = require('uuid');
const { asruEstablishment } = require('../../lib/resolvers');
const db = require('../helpers/db');
const assert = require('assert');

const PROFILE = uuidv4();

describe('ASRU-Establishment resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.models = models;
    this.asruEstablishment = asruEstablishment({ models });
  });

  beforeEach(async () => {
    transaction = await knexInstance.transaction();
    await db.clean(models);

    try {
      await models.Profile.query(knexInstance).insert({
        id: PROFILE,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterling@archer.com',
        telephone: '01234567890',
        dob: '1979-12-01',
        asruUser: true
      });

      await models.Establishment.query(knexInstance).insert({
        id: 100,
        name: 'Test University'
      });

      await models.AsruEstablishment.query(knexInstance)
        .insert({ establishmentId: 100,
          profileId: PROFILE });

    } catch (error) {
      console.log(error);
    }
  });

  after(async () => {
    await knexInstance.destroy();
    await db.clean(models);
  });

  it('rejects with an error if action is unknown', async () => {
    await assert.rejects(
      async () => this.asruEstablishment({ action: 'nope', data: {} }),
      { name: 'Error', message: /Unknown action: nope/ }
    );
  });

  describe('Create', () => {
    it('can create an association', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };
      await this.asruEstablishment(opts, transaction);

      const associations = await models.AsruEstablishment.query(knexInstance);

      assert.equal(associations.length, 1);
      assert.equal(associations[0].establishmentId, 100);
      assert.equal(associations[0].profileId, PROFILE);
    });

    it('does not create multiple associations for the same profile/establishment', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };
      return Promise.resolve()
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.models.AsruEstablishment.query())
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].establishmentId, 100);
          assert.equal(associations[0].profileId, PROFILE);
        });
    });
  });

  describe('Delete', () => {
    it('can delete an association', () => {
      return this.models.AsruEstablishment.query(knexInstance).insert({ establishmentId: 100, profileId: PROFILE })
        .then(() => {
          const opts = {
            action: 'delete',
            data: {
              establishmentId: 100,
              profileId: PROFILE
            }
          };

          return Promise.resolve()
            .then(() => this.asruEstablishment(opts))
            .then(() => this.models.AsruEstablishment.query(knexInstance))
            .then(associations => {
              assert.equal(associations.length, 0);
            });
        });
    });
  });

});
