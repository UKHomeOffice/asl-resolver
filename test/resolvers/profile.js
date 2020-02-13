const assert = require('assert');
const { profile } = require('../../lib/resolvers');
const db = require('../helpers/db');
const Logger = require('../../lib/utils/logger');

const ID_1 = 'e0b49357-237c-4042-b430-a57fc8e1be5f';
const ID_2 = '8e1ac9a5-31ef-4907-8ad3-5252ccc6eb8b';
const EST_1 = 8201;
const EST_2 = 8202;

describe('Profile resolver', () => {
  before(() => {
    this.models = db.init();
    this.profile = profile({ models: this.models, logger: Logger({ logLevel: 'silent' }) });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert([
        {
          id: ID_1,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        }
      ]));
  });

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.profile({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can create a new profile', () => {
      const params = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'rob.fryer@example.com',
          userId: '12345'
        }
      };

      return Promise.resolve()
        .then(() => this.profile(params))
        .then(profile => profile.id)
        .then(profileId => this.models.Profile.query().findById(profileId))
        .then(profile => {
          assert.ok(profile);
          assert.deepEqual(profile.firstName, params.data.firstName);
          assert.deepEqual(profile.lastName, params.data.lastName);
          assert.deepEqual(profile.userId, params.data.userId);
        });
    });

    it('updates the userId if it finds an existing profile', () => {
      const params = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'rob.fryer@example.com',
          userId: '12345'
        }
      };

      const params2 = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'ROB.FRYER@EXAMPLE.COM',
          userId: '54321'
        }
      };

      return Promise.resolve()
        .then(() => this.profile(params))
        .then(newProfile => {
          return Promise.resolve()
            .then(() => this.profile(params2))
            .then(() => this.models.Profile.query().findById(newProfile.id))
            .then(profile => {
              assert.ok(profile);
              assert.deepEqual(profile.firstName, params.data.firstName);
              assert.deepEqual(profile.lastName, params.data.lastName);
              assert.deepEqual(profile.userId, params2.data.userId);
            });
        });
    });
  });

  describe('Merge', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          {
            id: EST_1,
            name: 'Univerty of Croydon'
          },
          {
            id: EST_2,
            name: 'Marvell Pharmaceutical'
          }
        ]))
        .then(() => this.models.Profile.query().insert({
          id: ID_2,
          firstName: 'Cyril',
          lastName: 'Figgis',
          email: 'cyril@figgis.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        }));
    });

    it('throws an error if profiles to be merged both have active PILs', () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };
      return Promise.resolve()
        .then(() => this.models.PIL.query().insert([
          {
            profileId: ID_1,
            establishmentId: EST_1,
            status: 'active'
          },
          {
            profileId: ID_2,
            establishmentId: EST_2,
            status: 'active'
          }
        ]))
        .then(() => this.profile(params))
        .catch(err => {
          assert.equal(err.message, 'Cannot merge profiles as both have an active PIL', 'error not thrown');
        });
    });

    it('transfers permissions from profile to target', () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };
      return Promise.resolve()
        .then(() => this.models.Permission.query().insert([
          {
            profileId: ID_1,
            establishmentId: EST_1,
            role: 'admin'
          },
          {
            profileId: ID_1,
            establishmentId: EST_2,
            role: 'read'
          }
        ]).returning('*'))
        .then(() => this.profile(params))
        .then(() => this.models.Permission.query().where({ profileId: ID_2 }))
        .then(permissions => {
          assert.equal(permissions.length, 2, 'Permissions were not transferred to profile 2');
          const permission1 = permissions.find(p => p.establishmentId === EST_1);
          const permission2 = permissions.find(p => p.establishmentId === EST_2);
          assert.equal(permission1.role, 'admin', 'Profile 2 was not made an admin at establishment 1');
          assert.equal(permission2.role, 'read', 'Profile 2 was not made readonly at establishment 2');
        })
        .then(() => this.models.Permission.query().where({ profileId: ID_1 }))
        .then(permissions => {
          assert.equal(permissions.length, 0, 'Permissions were not removed from profile 1');
        });
    });

    it('transfers permissions if both profiles have permissions at the establishment', () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      return Promise.resolve()
        .then(() => this.models.Permission.query().insert([
          {
            profileId: ID_1,
            establishmentId: EST_1,
            role: 'admin'
          },
          {
            profileId: ID_2,
            establishmentId: EST_1,
            role: 'read'
          }
        ]).returning('*'))
        .then(() => this.profile(params))
        .then(() => this.models.Permission.query().where({ profileId: ID_2 }))
        .then(permissions => {
          assert.equal(permissions.length, 1, 'duplicate permission copied over');
        })
        .then(() => this.models.Permission.query().where({ profileId: ID_1 }))
        .then(permissions => {
          assert.equal(permissions.length, 0, 'permission not removed from profile 1');
        });
    });

    it('transfers over the other relations to target', () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };
      return Promise.resolve()
        .then(() => Promise.all([
          this.models.Project.query().insert({ licenceHolderId: ID_1, establishmentId: EST_1 }),
          this.models.PIL.query().insert({ profileId: ID_1, establishmentId: EST_1 }),
          this.models.Role.query().insert({ profileId: ID_1, establishmentId: EST_1, type: 'nacwo' }),
          this.models.Certificate.query().insert({ profileId: ID_1 }),
          this.models.Exemption.query().insert({ profileId: ID_1, module: 'L' })
        ]))
        .then(() => this.profile(params))
        .then(() => Promise.all([
          this.models.Project.query().where({ licenceHolderId: ID_1 }),
          this.models.PIL.query().where({ profileId: ID_1 }),
          this.models.Role.query().where({ profileId: ID_1 }),
          this.models.Certificate.query().where({ profileId: ID_1 }),
          this.models.Exemption.query().where({ profileId: ID_1 })
        ]))
        .then(models => {
          models.forEach(model => {
            assert.equal(model.length, 0, 'model was not removed from profile 1');
          });
        })
        .then(() => Promise.all([
          this.models.Project.query().where({ licenceHolderId: ID_2 }),
          this.models.PIL.query().where({ profileId: ID_2 }),
          this.models.Role.query().where({ profileId: ID_2 }),
          this.models.Certificate.query().where({ profileId: ID_2 }),
          this.models.Exemption.query().where({ profileId: ID_2 })
        ]))
        .then(models => {
          models.forEach(model => {
            assert.equal(model.length, 1, 'model was not transferred to profile 2');
          });
        });
    });

    it('transfers all roles to the target and prevents them from being duplicated', () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      return Promise.resolve()
        .then(() => {
          return this.models.Role.query().insert([
            { profileId: ID_1, establishmentId: EST_1, type: 'holc' },
            { profileId: ID_1, establishmentId: EST_1, type: 'nacwo' },
            { profileId: ID_2, establishmentId: EST_1, type: 'nacwo' }, // both profiles have nacwo role at est1
            { profileId: ID_2, establishmentId: EST_2, type: 'nacwo' }
          ]);
        })
        .then(() => this.profile(params))
        .then(() => {
          return this.models.Role.query().where({ profileId: ID_1 })
            .then(roles => {
              assert(roles.length === 0, 'all roles should be removed from the source profile');
            });
        })
        .then(() => {
          return this.models.Role.query().where({ profileId: ID_2 })
            .then(roles => {
              assert(roles.length === 3, 'the target profile should have three roles total');
              assert(roles.find(r => r.establishmentId === EST_1 && r.type === 'holc'), 'target is now holc at establishment 1');
              assert(roles.find(r => r.establishmentId === EST_1 && r.type === 'nacwo'), 'target retains nacwo at establishment 1');
              assert(roles.filter(r => r.establishmentId === EST_1 && r.type === 'nacwo').length === 1, 'only a single nacwo role for target at establishment 1');
              assert(roles.find(r => r.establishmentId === EST_2 && r.type === 'nacwo'), 'target retains nacwo at establishment 2');
            });
        });
    });
  });

  describe('Update', () => {
    it('can update a profile model', () => {
      const opts = {
        action: 'update',
        data: {
          firstName: 'Vincent',
          lastName: 'Malloy'
        },
        id: ID_1
      };
      return Promise.resolve()
        .then(() => this.profile(opts))
        .then(() => this.models.Profile.query().findById(ID_1))
        .then(profile => {
          assert.ok(profile);
          assert.deepEqual(profile.firstName, opts.data.firstName);
          assert.deepEqual(profile.lastName, opts.data.lastName);
        });
    });

    it('ignores superfluous params', () => {
      it('can update a profile model', () => {
        const opts = {
          action: 'update',
          data: {
            firstName: 'Vincent',
            lastName: 'Malloy',
            comments: 'I am changing my name because...',
            someField: 'This will be ignored'
          },
          id: ID_1
        };
        return Promise.resolve()
          .then(() => this.profile(opts))
          .then(() => this.models.Profile.query().findById(ID_1))
          .then(profile => {
            assert.ok(profile);
            assert.deepEqual(profile.comments, undefined);
            assert.deepEqual(profile.someField, undefined);
          });
      });
    });
  });
});
