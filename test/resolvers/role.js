const assert = require('assert');
const moment = require('moment');
const { v4: uuid } = require('uuid');
const { role } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = uuid();
const PROFILE_ID_2 = uuid();
const PROFILE_ID_3 = uuid();
const PROFILE_ID_4 = uuid();
const ROLE_ID = uuid();
const HOLC_ROLE_ID = uuid();
const PELH_ROLE_ID = uuid();

const NACWO_ROLE_ID = uuid();
const NACWO_ROLE_ID_2 = uuid();
const NVS_ROLE_ID = uuid();
const NVS_ROLE_ID_2 = uuid();

const PLACE_ID_1 = uuid();
const PLACE_ID_2 = uuid();

const REMINDER_ID = uuid();

const ESTABLISHMENT_ID = 8201;
const ESTABLISHMENT_ID_2 = 8202;

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

describe('Role resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.role = role({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert([
      {
        id: ESTABLISHMENT_ID,
        name: 'Univerty of Croydon',
        updatedAt: '2019-01-01T10:38:43.666Z'
      },
      {
        id: ESTABLISHMENT_ID_2,
        name: 'Marvell Pharmaceutical',
        updatedAt: '2019-01-01T10:38:43.666Z'
      }
    ]);

    await models.Profile.query(knexInstance).insert([
      {
        id: PROFILE_ID,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterling@archer.com'
      },
      {
        id: PROFILE_ID_2,
        firstName: 'James',
        lastName: 'Herriot',
        email: 'jh@example.com'
      },
      {
        id: PROFILE_ID_3,
        firstName: 'Yvette',
        lastName: 'Fielding',
        email: 'yf@example.com'
      },
      {
        id: PROFILE_ID_4,
        firstName: 'Steve',
        lastName: 'Oxford',
        email: 'so@example.com'
      }
    ]);

   await models.Role.query(knexInstance).insert([
      {
        id: ROLE_ID,
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID,
        type: 'nacwo'
      },
      {
        id: HOLC_ROLE_ID,
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID,
        type: 'holc'
      },
      {
        id: NACWO_ROLE_ID,
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID,
        type: 'nacwo'
      },
      {
        id: NACWO_ROLE_ID_2,
        establishmentId: ESTABLISHMENT_ID_2,
        profileId: PROFILE_ID,
        type: 'nacwo'
      },
      {
        id: NVS_ROLE_ID,
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID_3,
        type: 'nvs'
      },
      {
        id: NVS_ROLE_ID_2,
        establishmentId: ESTABLISHMENT_ID_2,
        profileId: PROFILE_ID_3,
        type: 'nvs'
      },
      {
        id: PELH_ROLE_ID,
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID,
        type: 'pelh'
      }
    ]);

    await models.Place.query(knexInstance).insert([
      {
        id: PLACE_ID_1,
        site: 'Site 1',
        area: 'Area 1',
        name: 'Place at Establishment 1',
        suitability: ['DOG'],
        holding: ['LTH'],
        establishmentId: ESTABLISHMENT_ID
      },
      {
        id: PLACE_ID_2,
        site: 'Site 2',
        area: 'Area 2',
        name: 'Place at Establishment 2',
        suitability: ['CAT'],
        holding: ['STH'],
        establishmentId: ESTABLISHMENT_ID_2
      }
    ]);

   await models.PlaceRole.query(knexInstance).insert([
      {
        placeId: PLACE_ID_1,
        roleId: NACWO_ROLE_ID
      },
      {
        placeId: PLACE_ID_1,
        roleId: NVS_ROLE_ID
      },
      {
        placeId: PLACE_ID_2,
        roleId: NACWO_ROLE_ID
      },
      {
        placeId: PLACE_ID_2,
        roleId: NVS_ROLE_ID
      }
    ]);
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.role({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {

    it('updates the establishment record', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID,
          type: 'nvs'
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment);
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('doesn\'t update the establishment record if a HOLC is assigned', async () => {
      let updatedAt;
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID,
          type: 'holc'
        }
      };

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      updatedAt = establishment.updatedAt;

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const responseEstablishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(responseEstablishment);
      assert.equal(responseEstablishment.updatedAt, updatedAt);
    });

    it('sets the rcvs number to the profile if creating an nvs', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID_2,
          rcvsNumber: '12345',
          type: 'nvs'
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(PROFILE_ID_2);
      assert.ok(profile);
      assert.equal(profile.rcvsNumber, '12345');
    });
  });

  describe('Delete', () => {

    it('rejects if not provided an id', () => {
      return assert.rejects(() => {
        return this.role({ action: 'delete', data: {} });
      }, {
        name: 'Error'
      });
    });

    it('updates the establishment record', async () => {
      const opts = {
        action: 'delete',
        id: ROLE_ID,
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment);
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('doesn\'t update the establishment record if a HOLC is removed', async () => {
      let updatedAt;
      const opts = {
        action: 'delete',
        id: HOLC_ROLE_ID,
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID
        }
      };

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      updatedAt = establishment.updatedAt;

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const responseEstablishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(responseEstablishment);
      assert.equal(responseEstablishment.updatedAt, updatedAt);
    });

    describe('Dissociate places', () => {

      it('removing a nacwo also dissociates the user from any related places at that establishment', async () => {
        const opts = {
          action: 'delete',
          id: NACWO_ROLE_ID,
          data: {
            establishmentId: ESTABLISHMENT_ID,
            profileId: PROFILE_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.role(opts, transaction);
        transaction.commit();

        const places = await models.Place.query(knexInstance).where({ establishmentId: ESTABLISHMENT_ID }).withGraphFetched('roles');
        places.forEach(place => {
          assert.ok(place.roles.every(role => role.id !== NACWO_ROLE_ID));
        });
      });

      it('removing an nvs also dissociates the user from any related places at that establishment', async () => {
        const opts = {
          action: 'delete',
          id: NVS_ROLE_ID,
          data: {
            establishmentId: ESTABLISHMENT_ID,
            profileId: PROFILE_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.role(opts, transaction);
        transaction.commit();

        const places = await models.Place.query(knexInstance).where({ establishmentId: ESTABLISHMENT_ID }).withGraphFetched('roles');
        places.forEach(place => {
          assert.ok(place.roles.every(role => role.id !== NVS_ROLE_ID));
        });
      });

      it('removing a nacwo role does not dissociate the user from places at other establishments', async () => {
        const opts = {
          action: 'delete',
          id: NACWO_ROLE_ID_2,
          data: {
            establishmentId: ESTABLISHMENT_ID_2,
            profileId: PROFILE_ID
          }
        };

        transaction = await knexInstance.transaction();
        await this.role(opts, transaction);
        transaction.commit();

        const place = await models.Place.query(knexInstance).findById(PLACE_ID_1).withGraphFetched('roles');
        assert.ok(place.roles.find(role => role.id === NACWO_ROLE_ID), 'NACWO role is still present on assigned place at establishment 1');
      });
    });
  });

  describe('Replace', () => {

    it('removes any existing roles and updates the establishment record', async () => {
      const opts = {
        action: 'replace',
        data: {
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_2,
          type: 'nprc',
          replaceRoles: ['nprc', 'pelh']
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment);
      nowish(establishment.updatedAt, new Date().toISOString());

      const roles = await models.Role.query(knexInstance).where({ establishmentId: ESTABLISHMENT_ID }).whereIn('type', ['pelh', 'nprc']);
      assert.ok(roles.length === 1);
      assert.ok(roles[0].type === 'nprc');
      assert.ok(roles[0].profileId === PROFILE_ID_2);
    });
  });

  describe('Updating conditions', () => {
    it('adds the establishment condition when included', async () => {
      const opts = {
        action: 'create',
        data: {
          conditions: 'Test condition',
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_4,
          type: 'nvs'
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment);
      assert.ok(establishment.conditions === 'Test condition');
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('adds the condition reminder when included', async () => {
      const opts = {
        action: 'replace',
        data: {
          conditions: 'Test condition',
          reminder: JSON.stringify(reminder),
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_4,
          type: 'pelh',
          replaceRoles: ['pelh', 'nprc']
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment.conditions === 'Test condition');

      const responseReminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID);
      assert.ok(responseReminder);
      nowish(responseReminder.updatedAt, new Date().toISOString());
    });

    it('removes the condition when it is not on the payload (deleted)', async () => {
      const opts = {
        action: 'replace',
        data: {
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_4,
          type: 'nprc',
          replaceRoles: ['nprc', 'pelh']
        }
      };

      transaction = await knexInstance.transaction();
      await this.role(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.ok(establishment.conditions === null);
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('removes the reminder when it has the deleted flag', async () => {
      const opts = {
        action: 'delete',
        id: NACWO_ROLE_ID_2,
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
      await this.role(opts, transaction);
      transaction.commit();

     const reminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID);
     assert.ok(reminder === undefined);
    });
  });
});
