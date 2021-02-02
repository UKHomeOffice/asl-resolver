const assert = require('assert');
const { emailPreferences } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

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
  before(() => {
    this.models = db.init();
    this.emailPreferences = emailPreferences({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert(establishment))
      .then(() => this.models.Profile.query().insert(holc))
      .then(() => this.models.Profile.query().insert(basic))
      .then(() => this.models.EmailPreferences.query().insert(basicEmailPreferences));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  it('can save preferences for a user with no existing preferences', () => {
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
    return Promise.resolve()
      .then(() => this.emailPreferences(opts))
      .then(() => this.models.EmailPreferences.query().findOne({ profileId: holc.id }))
      .then(record => {
        assert.ok(record);
        assert.deepStrictEqual(record.preferences, opts.data.preferences);
      });
  });

  it('can update existing preferences', () => {
    const opts = {
      id: basic.id,
      data: {
        profileId: basic.id,
        preferences: {
          newsletters: []
        }
      }
    };
    return Promise.resolve()
      .then(() => this.emailPreferences(opts))
      .then(() => this.models.EmailPreferences.query().findOne({ profileId: basic.id }))
      .then(record => {
        assert.ok(record);
        assert.deepStrictEqual(record.preferences, opts.data.preferences);
      });
  });

});
