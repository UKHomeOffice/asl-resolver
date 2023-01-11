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
  before(() => {
    this.models = db.init();
    this.place = place({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insertGraph({
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
          holding: JSON.stringify(['NOH'])
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

    it('creates role relations', () => {
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
      return Promise.resolve()
        .then(() => this.place(opts))
        .then(() => this.models.Place.query().withGraphFetched('roles').first())
        .then(place => {
          assert.ok(place);
          assert.equal(place.roles.length, 2, 'place should have 2 roles assigned');
          place.roles.map(role => {
            assert.equal(role.type, 'nacwo', 'both assigned roles should be nacwos');
          });
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

    it('updates the establishment record', () => {
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
      return Promise.resolve()
        .then(() => this.place(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          nowish(establishment.updatedAt, new Date().toISOString());
        });
    });
  });

  describe('with existing', () => {
    const PLACE_ID1 = uuid();
    const PLACE_ID2 = uuid();
    const PLACE_ID3 = uuid();

    beforeEach(() => {
      return this.models.Place.query().insertGraph([
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
      it('can patch a model', () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
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

      it('soft-deletes role relations when they are removed', () => {
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
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.PlaceRole.queryWithDeleted().where('placeId', PLACE_ID1))
          .then(placeRoles => {
            assert.equal(placeRoles.length, 2, 'there should be 2 role relations (inc. soft-deleted)');

            const nacwo1Relation = placeRoles.find(pr => pr.roleId === NACWO_ROLE_ID_1);
            assert(nacwo1Relation.deleted);
            assert(moment(nacwo1Relation.deleted).isValid());

            const nacwo2Relation = placeRoles.find(pr => pr.roleId === NACWO_ROLE_ID_2);
            assert(!nacwo2Relation.deleted);
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

      it('updates the establishment record', () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            suitability: JSON.stringify(['AQ', 'AV'])
          }
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment);
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });

      it('adds the establishment condition when included', () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            conditions: 'Test condition',
            establishmentId: ESTABLISHMENT_ID
          }
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment);
            assert.ok(establishment.conditions === 'Test condition');
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });

      it('adds the condition reminder when included', () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            conditions: 'Test condition',
            reminder: JSON.stringify(reminder),
            establishmentId: ESTABLISHMENT_ID
          }
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment.conditions === 'Test condition');
          })
          .then(() => this.models.Reminder.query().findById(REMINDER_ID))
          .then(reminder => {
            assert.ok(reminder);
            nowish(reminder.updatedAt, new Date().toISOString());
          });
      });

      it('removes the condition when it is not on the payload (deleted)', () => {
        const opts = {
          action: 'update',
          id: PLACE_ID3,
          data: {
            establishmentId: ESTABLISHMENT_ID
          }
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment.conditions === null);
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });

      it('removes the reminder when it has the deleted flag', () => {
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
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Reminder.query().findById(REMINDER_ID))
          .then(reminder => {
            assert.ok(reminder === undefined);
          });
      });

      it('removes any roles that are missing from the establishment', () => {
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
        return Promise.resolve()
          .then(() => this.models.Role.query().findById(NACWO_ROLE_ID_1).delete())
          .then(() => this.place(opts))
          .then(() => this.models.Place.query().findById(PLACE_ID1).withGraphFetched('roles'))
          .then(place => {
            assert.ok(place);
            assert.equal(place.roles.length, 1);
            assert.equal(place.roles[0].id, NACWO_ROLE_ID_2);
          });
      });
    });

    describe('Delete', () => {
      it('soft deletes the model', () => {
        const opts = {
          action: 'delete',
          id: PLACE_ID2
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

      it('updates the establishment record', () => {
        const opts = {
          action: 'delete',
          id: PLACE_ID2
        };
        return Promise.resolve()
          .then(() => this.place(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment);
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });
    });
  });
});
