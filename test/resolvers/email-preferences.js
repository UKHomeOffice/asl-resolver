const assert = require('assert');
const { emailPreferences } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

const establishment = {
  id: 8201,
  name: 'University of Croydon'
};

const holc = {
  id: uuid(),
  firstName: 'Bruce',
  lastName: 'Banner',
  email: 'holcymcholcface@example.com'
};

const basic = {
  id: uuid(),
  firstName: 'Basic',
  lastName: 'User',
  email: 'basic@example.com'
};

const basicEmailPreferences = {
  profileId: basic.id,
  preferences: {
    newsletters: ['operational']
  }
};

describe('Email preferences resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.emailPreferences = emailPreferences({ models });
  });

  beforeEach(async () => {
    await db.clean(models);
    await models.Establishment.query(knexInstance).insert(establishment);
    await models.Profile.query(knexInstance).insert(holc);
    await models.Profile.query(knexInstance).insert(basic);
    await models.EmailPreferences.query(knexInstance).insert(basicEmailPreferences);
  });

  afterEach(async () => {
    await db.clean(models);
  });

  after(async () => {
    await db.clean(models);
    await knexInstance.destroy();
  });

  it('can save preferences for a user with no existing preferences', async () => {
    const opts = {
      id: holc.id,
      data: {
        profileId: holc.id,
        preferences: {
          newsletters: ['operational'],
          'alerts-8201': ['pil', 'pel']
        }
      }
    };

    transaction = await knexInstance.transaction();
    await this.emailPreferences(opts, transaction);
    await transaction.commit();
    const record = await models.EmailPreferences.query(knexInstance).findOne({ profileId: holc.id });

    assert.ok(record);
    assert.deepStrictEqual(record.preferences, opts.data.preferences);
  });

  it('can update existing preferences', async () => {
    const opts = {
      id: basic.id,
      data: {
        profileId: basic.id,
        preferences: {
          newsletters: []
        }
      }
    };

    transaction = await knexInstance.transaction();
    await this.emailPreferences(opts, transaction);
    await transaction.commit();
    const record = await models.EmailPreferences.query(knexInstance).findOne({ profileId: basic.id });

    assert.ok(record);
    assert.deepStrictEqual(record.preferences, opts.data.preferences);
  });

});
