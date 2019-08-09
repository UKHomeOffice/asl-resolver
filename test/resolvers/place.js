const assert = require('assert');
const moment = require('moment');
const { place } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = '80aed65b-ff2b-409f-918b-0cdab4a6d08b';
const ESTABLISHMENT_ID = 8201;

describe('Place resolver', () => {
  before(() => {
    this.models = db.init();
    this.place = place({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert({
        id: ESTABLISHMENT_ID,
        name: 'Univerty of Croydon'
      }))
      .then(() => this.models.Profile.query().insert({
        id: PROFILE_ID,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterling@archer.com'
      }))
      .then(() => this.models.Role.query().insert({
        establishmentId: ESTABLISHMENT_ID,
        profileId: PROFILE_ID,
        type: 'nacwo'
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
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
    it('can insert a place model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: JSON.stringify(['SA']),
          holding: JSON.stringify(['NOH']),
          nacwo: PROFILE_ID
        }
      };
      return Promise.resolve()
        .then(() => this.place(opts))
        .then(() => this.models.Place.query())
        .then(places => places[0])
        .then(place => {
          assert.ok(place);
          assert.deepEqual(place.name, opts.data.name);
          assert.deepEqual(place.site, opts.data.site);
          assert.deepEqual(place.suitability, JSON.parse(opts.data.suitability));
          assert.deepEqual(place.holding, JSON.parse(opts.data.holding));
        });
    });

    it('can insert a place model with no NACWO', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'Another room',
          site: 'Another site',
          suitability: JSON.stringify(['SA']),
          holding: JSON.stringify(['NOH']),
          nacwo: ''
        }
      };
      return Promise.resolve()
        .then(() => this.place(opts))
        .then(() => this.models.Place.query())
        .then(places => places[0])
        .then(place => {
          assert.ok(place);
          assert.deepEqual(place.name, opts.data.name);
          assert.deepEqual(place.site, opts.data.site);
          assert.deepEqual(place.suitability, JSON.parse(opts.data.suitability));
          assert.deepEqual(place.holding, JSON.parse(opts.data.holding));
        });
    });

    it('can reject an invalid place model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          name: 'A room',
          nacwo: PROFILE_ID
        }
      };
      return assert.rejects(() => {
        return this.place(opts);
      }, { name: 'ValidationError' });
    });
  });

  describe('with existing', () => {
    beforeEach(() => {
      return this.models.Place.query().insert([
        {
          id: '1f6f88e8-7beb-4499-9b1a-170fa58de494',
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: ['SA'],
          holding: ['NOH']
        },
        {
          id: '453decad-b438-4f2c-8af1-71258afd6569',
          establishmentId: 8201,
          name: 'B room',
          site: 'B site',
          suitability: ['LA', 'DOG'],
          holding: ['NSEP']
        },
        {
          id: 'd7e72073-c87c-4f43-ae14-5bea519e8114',
          establishmentId: 8201,
          name: 'A room',
          site: 'A site',
          suitability: ['SA', 'AQ'],
          holding: ['SEP', 'NOH']
        }
      ]);
    });

    describe('Update', () => {
      it('can patch a model', () => {
        const opts = {
          action: 'update',
          id: 'd7e72073-c87c-4f43-ae14-5bea519e8114',
          data: {
            suitability: JSON.stringify(['AQ', 'AV'])
          }
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Place.query().findById(opts.id))
          .then(place => {
            assert.deepEqual(place.suitability, JSON.parse(opts.data.suitability));
            assert.deepEqual(place.holding, ['SEP', 'NOH']);
          });
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
    });

    describe('Delete', () => {
      it('soft deletes the model', () => {
        const opts = {
          action: 'delete',
          id: '453decad-b438-4f2c-8af1-71258afd6569'
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Place.query().findById(opts.id))
          .then(place => {
            assert.deepEqual(place, undefined);
          })
          .then(() => this.models.Place.queryWithDeleted().findById(opts.id))
          .then(place => {
            assert(place.deleted);
            assert(moment(place.deleted).isValid());
          });
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
    });
  });
});
