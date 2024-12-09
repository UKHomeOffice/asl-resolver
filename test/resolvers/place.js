const assert = require('assert');
const moment = require('moment');
const { place } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const ESTABLISHMENT_ID = 8201;
const PROFILE_ID_1 = uuid();
const PROFILE_ID_2 = uuid();
const NACWO_ROLE_ID_1 = uuid();
const NACWO_ROLE_ID_2 = uuid();
const REMINDER_ID = uuid();

const nowish = (a, b, n = 3) => {
  const diff = moment(a).diff(b, 'seconds');
  assert.ok(Math.abs(diff) < n, `${a} should be within ${n} seconds of ${b}`);
};

const reminder = {
  id: REMINDER_ID,
  deadline: '2022-07-30',
  modelType: 'establishment',
  status: 'active'
};

describe('Place resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.place = place({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insertGraph({
        id: ESTABLISHMENT_ID,
        name: 'Univerty of Croydon',
        updatedAt: '2019-01-01T10:38:43.666Z',
        profiles: [{
          id: PROFILE_ID_1,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterline@archer.com'
        },
        {
          id: PROFILE_ID_2,
          firstName: 'Vincent',
          lastName: 'Malloy',
          email: 'vincent@price.com'
        }],
        roles: [{
          id: NACWO_ROLE_ID_1,
          type: 'nacwo',
          profileId: PROFILE_ID_1
        }, {
          id: NACWO_ROLE_ID_2,
          type: 'nacwo',
          profileId: PROFILE_ID_2
        }]
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.place({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a place model', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: JSON.stringify(['SA']),
          holding: JSON.stringify(['NOH'])
        }
      };

      transaction = await knexInstance.transaction();
      await this.place(opts, transaction);
      transaction.commit();

      const places = await models.Place.query(knexInstance);
      const place = places[0];

      assert.ok(place);
      assert.deepEqual(place.name, opts.data.name);
      assert.deepEqual(place.site, opts.data.site);
      assert.deepEqual(place.suitability, JSON.parse(opts.data.suitability));
      assert.deepEqual(place.holding, JSON.parse(opts.data.holding));
    });

    it('creates role relations', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: [],
          holding: [],
          roles: [
            NACWO_ROLE_ID_1,
            NACWO_ROLE_ID_2
          ]
        }
      };

      transaction = await knexInstance.transaction();
      await this.place(opts, transaction);
      transaction.commit();

      const place = await models.Place.query(knexInstance).withGraphFetched('roles').first();
      assert.ok(place);
      assert.equal(place.roles.length, 2, 'place should have 2 roles assigned');

      place.roles.map(role => {
        assert.equal(role.type, 'nacwo', 'both assigned roles should be nacwos');
      });
    });

    it('can reject an invalid place model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room'
        }
      };
      return assert.rejects(() => {
        return this.place(opts);
      }, { name: 'ValidationError' });
    });

    it('updates the establishment record', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: JSON.stringify(['SA']),
          holding: JSON.stringify(['NOH'])
        }
      };

      transaction = await knexInstance.transaction();
      await this.place(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment);
      nowish(establishment.updatedAt, new Date().toISOString());
    });
  });

  describe('with existing', () => {
    const PLACE_ID1 = uuid();
    const PLACE_ID2 = uuid();
    const PLACE_ID3 = uuid();

    beforeEach(async () => {
      await models.Place.query(knexInstance).insertGraph([
        {
          id: PLACE_ID1,
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: ['SA'],
          holding: ['NOH'],
          roles: [
            { id: NACWO_ROLE_ID_1 }
          ]
        },
        {
          id: PLACE_ID2,
          establishmentId: 8201,
          name: 'B room',
          site: 'B site',
          suitability: ['LA', 'DOG'],
          holding: ['NSEP']
        },
        {
          id: PLACE_ID3,
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: ['SA', 'AQ'],
          holding: ['SEP', 'NOH']
        }
      ], { relate: true });
    });

    describe('Update', () => {
      it('can patch a model', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            suitability: JSON.stringify(['AQ', 'AV'])
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const place = await models.Place.query(knexInstance).findById(opts.id);
        assert.deepEqual(place.suitability, JSON.parse(opts.data.suitability));
        assert.deepEqual(place.holding, ['SEP', 'NOH']);
      });

      it('soft-deletes role relations when they are removed', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID1,
          data: {
            name: 'A room',
            site: 'A site',
            suitability: ['SA'],
            holding: ['NOH'],
            roles: [NACWO_ROLE_ID_2]
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const placeRoles = await models.PlaceRole.queryWithDeleted(knexInstance).where('placeId', PLACE_ID1);
        assert.equal(placeRoles.length, 2, 'there should be 2 role relations (inc. soft-deleted)');

        const nacwo1Relation = placeRoles.find(pr => pr.roleId === NACWO_ROLE_ID_1);
        assert(nacwo1Relation.deleted);
        assert(moment(nacwo1Relation.deleted).isValid());

        const nacwo2Relation = placeRoles.find(pr => pr.roleId === NACWO_ROLE_ID_2);
        assert(!nacwo2Relation.deleted);
      });

      it('rejects with an error if id omitted', () => {
        const opts = {
          action: 'update',
          data: {
            suitability: JSON.stringify(['AQ', 'AV'])
          }
        };
        return assert.rejects(() => {
          return this.place(opts);
        }, {
          name: 'Error',
          message: /id is required on update/
        });
      });

      it('updates the establishment record', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            suitability: JSON.stringify(['AQ', 'AV'])
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const establishment = await models.Establishment.query(knexInstance).findById(8201);
        assert.ok(establishment);
        nowish(establishment.updatedAt, new Date().toISOString());
      });

      it('adds the establishment condition when included', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            conditions: 'Test condition',
            establishmentId: ESTABLISHMENT_ID
          }
        };
        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const establishment = await models.Establishment.query(knexInstance).findById(8201);
        assert.ok(establishment);
        assert.ok(establishment.conditions === 'Test condition');
        nowish(establishment.updatedAt, new Date().toISOString());
      });

      it('adds the condition reminder when included', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            conditions: 'Test condition',
            reminder: JSON.stringify(reminder),
            establishmentId: ESTABLISHMENT_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const establishment = await models.Establishment.query(knexInstance).findById(8201);
        assert.ok(establishment.conditions === 'Test condition');

        const responseReminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID);
        assert.ok(responseReminder);
        nowish(responseReminder.updatedAt, new Date().toISOString());
      });

      it('removes the condition when it is not on the payload (deleted)', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            establishmentId: ESTABLISHMENT_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const establishment = await models.Establishment.query(knexInstance).findById(8201);
        assert.ok(establishment.conditions === null);
        nowish(establishment.updatedAt, new Date().toISOString());
      });

      it('removes the reminder when it has the deleted flag', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            conditions: 'Test condition',
            reminder: JSON.stringify({
              id: REMINDER_ID,
              deadline: '2022-07-30',
              modelType: 'establishment',
              status: 'active',
              deleted: true
            }),
            establishmentId: ESTABLISHMENT_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const reminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID);
        assert.ok(reminder === undefined);
      });

      it('removes any roles that are missing from the establishment', async () => {
        const opts = {
          action: 'update',
          id: PLACE_ID1,
          data: {
            name: 'A room',
            site: 'A site',
            suitability: ['SA'],
            holding: ['NOH'],
            roles: [
              NACWO_ROLE_ID_1,
              NACWO_ROLE_ID_2
            ]
          }
        };

        await models.Role.query(knexInstance).findById(NACWO_ROLE_ID_1).delete();

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const place = await models.Place.query(knexInstance).findById(PLACE_ID1).withGraphFetched('roles');
        assert.ok(place);
        assert.equal(place.roles.length, 1);
        assert.equal(place.roles[0].id, NACWO_ROLE_ID_2);
      });
    });

    describe('Delete', () => {
      it('soft deletes the model', async () => {
        const opts = {
          action: 'delete',
          id: PLACE_ID2
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const place = await models.Place.query(knexInstance).findById(opts.id);
        assert.deepEqual(place, undefined);

        const placeMarkedAsDeleted = await models.Place.queryWithDeleted(knexInstance).findById(opts.id);
        assert(placeMarkedAsDeleted.deleted);
        assert(moment(placeMarkedAsDeleted.deleted).isValid());
      });

      it('throws an error if id omitted', () => {
        const opts = {
          action: 'delete'
        };
        return assert.rejects(() => {
          return this.place(opts);
        }, {
          name: 'Error',
          message: /id is required on delete/
        });
      });

      it('updates the establishment record', async () => {
        const opts = {
          action: 'delete',
          id: PLACE_ID2
        };

        transaction = await knexInstance.transaction();
        await this.place(opts, transaction);
        transaction.commit();

        const establishment = models.Establishment.query(knexInstance).findById(8201);
        assert.ok(establishment);
        nowish(establishment.updatedAt, new Date().toISOString());
      });
    });
  });
});
