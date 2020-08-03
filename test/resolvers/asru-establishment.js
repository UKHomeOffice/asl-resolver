const assert = require('assert');
const uuid = require('uuid/v4');
const { asruEstablishment } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE = uuid();

describe('ASRU-Establishment resolver', () => {
  before(() => {
    this.models = db.init();
    this.asruEstablishment = asruEstablishment({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert([
        {
          id: PROFILE,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          telephone: '01234567890',
          dob: '1979-12-01',
          asruUser: true
        }
      ]))
      .then(() => this.models.Establishment.query().insert([
        {
          id: 100,
          name: 'Test University'
        }
      ]));
  });

  after(() => {
    return this.models.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.asruEstablishment({ action: 'nope', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: nope/
    });
  });

  describe('Create', () => {
    it('can create an association', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };
      return Promise.resolve()
        .then(() => this.asruEstablishment(opts))
        .then(() => this.models.AsruEstablishment.query())
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].establishmentId, 100);
          assert.equal(associations[0].profileId, PROFILE);
        });
    });
    it('does not create multiple associations for the same profile/establishment', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };
      return Promise.resolve()
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.asruEstablishment(opts))
        .then(() => this.models.AsruEstablishment.query())
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].establishmentId, 100);
          assert.equal(associations[0].profileId, PROFILE);
        });
    });
  });

  describe('Delete', () => {
    it('can delete an association', () => {
      return this.models.AsruEstablishment.query().insert({ establishmentId: 100, profileId: PROFILE })
        .then(() => {
          const opts = {
            action: 'delete',
            data: {
              establishmentId: 100,
              profileId: PROFILE
            }
          };

          return Promise.resolve()
            .then(() => this.asruEstablishment(opts))
            .then(() => this.models.AsruEstablishment.query())
            .then(associations => {
              assert.equal(associations.length, 0);
            });
        });
    });
  });

});
