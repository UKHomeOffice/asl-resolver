const assert = require('assert');
const uuid = require('uuid/v4');
const { reminder } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = uuid();
const PIL_ID = uuid();
const ASRU_ID = uuid();
const REMINDER_ID = uuid();

describe('Reminder resolver', () => {
  before(() => {
    this.models = db.init();
    this.resolver = reminder({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert([
        {
          id: 8201,
          name: 'Univerty of Croydon'
        }
      ]))
      .then(() => this.models.Profile.query().insertGraph({
        id: ASRU_ID,
        firstName: 'Inspector',
        lastName: 'Morse',
        email: 'asru@example.com',
        asruUser: true
      }))
      .then(() => this.models.Profile.query().insertGraph({
        id: PROFILE_ID,
        firstName: 'Linford',
        lastName: 'Christie',
        email: 'test1@example.com',
        pil: {
          id: PIL_ID,
          establishmentId: 8201
        }
      }))
      .then(() => this.models.Reminder.query().insert({
        id: REMINDER_ID,
        deadline: '2022-07-30',
        modelType: 'project',
        modelId: uuid(),
        establishmentId: 8201,
        conditionKey: 'nmbas',
        status: 'active'
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
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
    it('can dismiss reminders', () => {
      const params = {
        id: REMINDER_ID,
        action: 'dismiss',
        data: {
          profileId: PROFILE_ID
        },
        changedBy: PROFILE_ID
      };

      return this.resolver(params)
        .then(() => {
          return this.models.Reminder.query().findById(REMINDER_ID).withGraphFetched('dismissed');
        })
        .then(reminder => {
          assert.equal(reminder.dismissed.length, 1);
          assert.equal(reminder.dismissed[0].profileId, PROFILE_ID);
        });
    });
  });

});
