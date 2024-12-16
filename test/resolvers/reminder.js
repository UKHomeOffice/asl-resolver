const assert = require('assert');
const uuid = require('uuid/v4');
const { reminder } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = uuid();
const PIL_ID = uuid();
const ASRU_ID = uuid();
const REMINDER_ID = uuid();

describe('Reminder resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.resolver = reminder({ models });
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

    await models.Reminder.query(knexInstance).insert({
        id: REMINDER_ID,
        deadline: '2022-07-30',
        modelType: 'project',
        modelId: uuid(),
        establishmentId: 8201,
        conditionKey: 'nmbas',
        status: 'active'
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('fails with an error if unexpected action received', () => {
    const action = 'doSomething';
    return assert.rejects(() => {
      return this.resolver({ action });
    }, {
      name: 'Error',
      message: `Unknown action: ${action}`
    });
  });

  describe('dismiss', () => {
    it('can dismiss reminders', async () => {
      const params = {
        id: REMINDER_ID,
        action: 'dismiss',
        data: {
          profileId: PROFILE_ID
        },
        changedBy: PROFILE_ID
      };

      transaction = await knexInstance.transaction();
      await this.resolver(params, transaction);
      transaction.commit();

      const reminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID).withGraphFetched('dismissed');
      assert.equal(reminder.dismissed.length, 1);
      assert.equal(reminder.dismissed[0].profileId, PROFILE_ID);
    });
  });

});
