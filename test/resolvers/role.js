const assert = require('assert');
const moment = require('moment');
const { role } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = '80aed65b-ff2b-409f-918b-0cdab4a6d08b';
const PROFILE_ID_2 = '80aed65b-ff2b-409f-918b-0cdab4a6d082';
const ROLE_ID = '80aed65b-ff2b-409f-918b-0cdab4a6d08c';
const HOLC_ROLE_ID = '35a51aed-d489-4d73-a1fe-599947beb72e';

const NACWO_ROLE_ID = 'ea07f16a-f9f9-402a-b916-951830dfe730';
const NACWO_ROLE_ID_2 = 'cbcaddc0-7e31-4eb0-bc93-10cd29ece6e9';

const ESTABLISHMENT_ID = 8201;
const ESTABLISHMENT_ID_2 = 8202;

const nowish = (a, b, n = 3) => {
  const diff = moment(a).diff(b, 'seconds');
  assert.ok(Math.abs(diff) < n, `${a} should be within ${n} seconds of ${b}`);
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
        }
      ]))
      .then(() => this.models.Place.query().insert([
        {
          site: 'Site 1',
          area: 'Area 1',
          name: 'Place at Establishment 1',
          suitability: ['DOG'],
          holding: ['LTH'],
          establishmentId: ESTABLISHMENT_ID,
          nacwoId: NACWO_ROLE_ID
        },
        {
          site: 'Site 2',
          area: 'Area 2',
          name: 'Place at Establishment 2',
          suitability: ['CAT'],
          holding: ['STH'],
          establishmentId: ESTABLISHMENT_ID_2,
          nacwoId: NACWO_ROLE_ID_2
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
          .then(() => this.models.Place.query().where({ nacwoId: NACWO_ROLE_ID }))
          .then(places => {
            assert.equal(places.length, 0, 'there should be no places with that nacwo role id');
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
          .then(() => this.models.Place.query().where({ nacwoId: NACWO_ROLE_ID }))
          .then(places => {
            assert.equal(places.length, 1, 'the profile should still be nacwo for the place at establishment 1');
          });
      });

    });

  });
});
