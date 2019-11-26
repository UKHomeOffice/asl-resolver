const assert = require('assert');
const moment = require('moment');
const { role } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE_ID = '80aed65b-ff2b-409f-918b-0cdab4a6d08b';
const ROLE_ID = '80aed65b-ff2b-409f-918b-0cdab4a6d08c';
const HOLC_ROLE_ID = '35a51aed-d489-4d73-a1fe-599947beb72e';
const ESTABLISHMENT_ID = 8201;

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
      .then(() => this.models.Establishment.query().insert({
        id: ESTABLISHMENT_ID,
        name: 'Univerty of Croydon',
        updatedAt: '2019-01-01T10:38:43.666Z'
      }))
      .then(() => this.models.Profile.query().insert({
        id: PROFILE_ID,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterling@archer.com'
      }))
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
  });
});
