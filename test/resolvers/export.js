const assert = require('assert');
const uuid = require('uuid/v4');
const resolver = require('../../lib/resolvers/export');
const db = require('../helpers/db');

const PROFILE_ID = uuid();

describe('Export resolver', () => {
  before(() => {
    this.models = db.init();
    this.resolver = resolver({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert([
        {
          id: PROFILE_ID,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          telephone: '01234567890',
          dob: '1979-12-01',
          asruUser: true
        }
      ]));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  describe('create', () => {

    it('adds a pending Export record', () => {
      const params = {
        action: 'create',
        data: {
          type: 'rops',
          key: '2021',
          profileId: PROFILE_ID
        }
      };

      return this.resolver(params)
        .then(() => {
          return this.models.Export.query();
        })
        .then(results => {
          assert.equal(results.length, 1);
          assert.equal(results[0].type, 'rops');
          assert.equal(results[0].key, '2021');
          assert.equal(results[0].profileId, PROFILE_ID);
          assert.equal(results[0].ready, false);
        });
    });

  });

  describe('delete', () => {

    beforeEach(() => {
      this.id = uuid();
      return this.models.Export.query().insert({ id: this.id, type: 'rops', key: '2021', profileId: PROFILE_ID });
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
