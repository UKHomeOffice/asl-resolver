const assert = require('assert');
const moment = require('moment');
const uuid = require('uuid').v4;
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
  before(() => {
    this.models = db.init();
    this.role = role({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert([
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
      ]))
      .then(() => this.models.Profile.query().insert([
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
      ]))
      .then(() => this.models.Role.query().insert([
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
      ]))
      .then(() => this.models.Place.query().insert([
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
      ]))
      .then(() => this.models.PlaceRole.query().insert([
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
      ]));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
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

    it('updates the establishment record', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID,
          type: 'nvs'
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          nowish(establishment.updatedAt, new Date().toISOString());
        });
    });

    it('doesn\'t update the establishment record if a HOLC is assigned', () => {
      let updatedAt;
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID,
          type: 'holc'
        }
      };

      return Promise.resolve()
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          updatedAt = establishment.updatedAt;
        })
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          assert.equal(establishment.updatedAt, updatedAt);
        });
    });

    it('sets the rcvs number to the profile if creating an nvs', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID_2,
          rcvsNumber: '12345',
          type: 'nvs'
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Profile.query().findById(PROFILE_ID_2))
        .then(profile => {
          assert.ok(profile);
          assert.equal(profile.rcvsNumber, '12345');
        });
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

    it('updates the establishment record', () => {
      const opts = {
        action: 'delete',
        id: ROLE_ID,
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          nowish(establishment.updatedAt, new Date().toISOString());
        });
    });

    it('doesn\'t update the establishment record if a HOLC is removed', () => {
      let updatedAt;
      const opts = {
        action: 'delete',
        id: HOLC_ROLE_ID,
        data: {
          establishmentId: 8201,
          profileId: PROFILE_ID
        }
      };

      return Promise.resolve()
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          updatedAt = establishment.updatedAt;
        })
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          assert.equal(establishment.updatedAt, updatedAt);
        });
    });

    describe('Dissociate places', () => {

      it('removing a nacwo also dissociates the user from any related places at that establishment', () => {
        const opts = {
          action: 'delete',
          id: NACWO_ROLE_ID,
          data: {
            establishmentId: ESTABLISHMENT_ID,
            profileId: PROFILE_ID
          }
        };
        return Promise.resolve()
          .then(() => this.role(opts))
          .then(() => this.models.Place.query().where({ establishmentId: ESTABLISHMENT_ID }).withGraphFetched('roles'))
          .then(places => {
            places.forEach(place => {
              assert.ok(place.roles.every(role => role.id !== NACWO_ROLE_ID));
            });
          });
      });

      it('removing an nvs also dissociates the user from any related places at that establishment', () => {
        const opts = {
          action: 'delete',
          id: NVS_ROLE_ID,
          data: {
            establishmentId: ESTABLISHMENT_ID,
            profileId: PROFILE_ID
          }
        };
        return Promise.resolve()
          .then(() => this.role(opts))
          .then(() => this.models.Place.query().where({ establishmentId: ESTABLISHMENT_ID }).withGraphFetched('roles'))
          .then(places => {
            places.forEach(place => {
              assert.ok(place.roles.every(role => role.id !== NVS_ROLE_ID));
            });
          });
      });

      it('removing a nacwo role does not dissociate the user from places at other establishments', () => {
        const opts = {
          action: 'delete',
          id: NACWO_ROLE_ID_2,
          data: {
            establishmentId: ESTABLISHMENT_ID_2,
            profileId: PROFILE_ID
          }
        };
        return Promise.resolve()
          .then(() => this.role(opts))
          .then(() => this.models.Place.query().findById(PLACE_ID_1).withGraphFetched('roles'))
          .then(place => {
            assert.ok(place.roles.find(role => role.id === NACWO_ROLE_ID), 'NACWO role is still present on assigned place at establishment 1');
          });
      });

    });

  });

  describe('Replace', () => {

    it('removes any existing roles and updates the establishment record', () => {
      const opts = {
        action: 'replace',
        data: {
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_2,
          type: 'nprc',
          replaceRoles: ['nprc', 'pelh']
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          nowish(establishment.updatedAt, new Date().toISOString());
        })
        .then(() => this.models.Role.query().where({ establishmentId: ESTABLISHMENT_ID }).whereIn('type', ['pelh', 'nprc']))
        .then(roles => {
          assert.ok(roles.length === 1);
          assert.ok(roles[0].type === 'nprc');
          assert.ok(roles[0].profileId === PROFILE_ID_2);
        });
    });
  });

  describe('Updating conditions', () => {
    it('adds the establishment condition when included', () => {
      const opts = {
        action: 'create',
        data: {
          conditions: 'Test condition',
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_4,
          type: 'nvs'
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment);
          nowish(establishment.updatedAt, new Date().toISOString());
        });
    });

    it('adds the condition reminder when included', () => {
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
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Reminder.query().findById(REMINDER_ID))
        .then(reminder => {
          assert.ok(reminder);
          nowish(reminder.updatedAt, new Date().toISOString());
        });
    });

    it('removes the condition when it is blank (deleted)', () => {
      const opts = {
        action: 'replace',
        data: {
          conditions: '',
          establishmentId: ESTABLISHMENT_ID,
          profileId: PROFILE_ID_4,
          type: 'nprc',
          replaceRoles: ['nprc', 'pelh']
        }
      };
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.ok(establishment.conditions === null);
          nowish(establishment.updatedAt, new Date().toISOString());
        });
    });

    it('removes the reminder when it has the deleted flag', () => {
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
      return Promise.resolve()
        .then(() => this.role(opts))
        .then(() => this.models.Reminder.query().findById(REMINDER_ID))
        .then(reminder => {
          assert.ok(reminder === undefined);
        });
    });
  });
});
