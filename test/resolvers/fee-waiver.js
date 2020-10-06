const assert = require('assert');
const uuid = require('uuid/v4');
const { feeWaiver } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = uuid();
const PIL_ID = uuid();
const ASRU_ID = uuid();

describe('FeeWaiver resolver', () => {
  before(() => {
    this.models = db.init();
    this.resolver = feeWaiver({ models: this.models });
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
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  describe('create', () => {

    it('adds a FeeWaiver record for the profile/establishment/year', () => {
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

      return this.resolver(params)
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
        })
        .then(results => {
          assert.equal(results.length, 1);
          assert.equal(results[0].waivedById, ASRU_ID);
          assert.equal(results[0].comment, 'Test comment');
        });
    });

    it('adds a single record if called mutiple times with the same profile/establishment/year', () => {
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

      return Promise.resolve()
        .then(() => this.resolver(params))
        .then(() => this.resolver(params))
        .then(() => this.resolver(params))
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
        })
        .then(results => {
          assert.equal(results.length, 1);
          assert.equal(results[0].establishmentId, 8201);
          assert.equal(results[0].profileId, PROFILE_ID);
          assert.equal(results[0].year, 2019);
          assert.equal(results[0].waivedById, ASRU_ID);
          assert.equal(results[0].comment, 'Test comment');
        });
    });

  });

  describe('delete', () => {

    it('removes any existing record for the profile/establishment/year', () => {
      const params = {
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          year: 2019,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      return Promise.resolve()
        .then(() => {
          return this.resolver({ ...params, action: 'create' });
        })
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
        })
        .then(results => {
          assert.equal(results.length, 1);
        })
        .then(() => {
          return this.resolver({ ...params, action: 'delete' });
        })
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201, year: 2019 });
        })
        .then(results => {
          assert.equal(results.length, 0);
        });
    });

    it('leaves existing record for a different year', () => {
      const params = {
        data: {
          profileId: PROFILE_ID,
          establishmentId: 8201,
          comment: 'Test comment'
        },
        changedBy: ASRU_ID
      };

      return Promise.resolve()
        .then(() => {
          params.data.year = 2018;
          return this.resolver({ ...params, action: 'create' });
        })
        .then(() => {
          params.data.year = 2019;
          return this.resolver({ ...params, action: 'create' });
        })
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201 });
        })
        .then(results => {
          assert.equal(results.length, 2);
        })
        .then(() => {
          params.data.year = 2018;
          return this.resolver({ ...params, action: 'delete' });
        })
        .then(() => {
          return this.models.FeeWaiver.query().where({ profileId: PROFILE_ID, establishmentId: 8201 });
        })
        .then(results => {
          assert.equal(results.length, 1);
          assert.equal(results[0].profileId, PROFILE_ID);
          assert.equal(results[0].establishmentId, 8201);
          assert.equal(results[0].year, 2019);
        });
    });

  });

});
