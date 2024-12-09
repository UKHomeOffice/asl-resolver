const moment = require('moment');
const assert = require('assert');
const { profile } = require('../../lib/resolvers');
const db = require('../helpers/db');
const Logger = require('../../lib/utils/logger');
const jwt = require('../../lib/jwt');
const emailer = require('../helpers/emailer');

const ID_1 = 'e0b49357-237c-4042-b430-a57fc8e1be5f';
const ID_2 = '8e1ac9a5-31ef-4907-8ad3-5252ccc6eb8b';
const EST_1 = 8201;
const EST_2 = 8202;

const isNowish = (date) => {
  return moment(date).isBetween(moment().subtract(5, 'seconds'), moment().add(5, 'seconds'));
};

describe('Profile resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.jwt = jwt({ secret: 'hunter2' });
    this.profile = profile({
      models: models,
      jwt: this.jwt,
      keycloak: {
        grantToken: () => Promise.resolve('abc'),
        updateUser: () => Promise.resolve()
      },
      emailer,
      logger: Logger({ logLevel: 'silent' })
    });
  });

  beforeEach(async () => {
    await db.clean(models);

    emailer.sendEmail.resetHistory();

    await models.Profile.query(knexInstance).insert([
        {
          id: ID_1,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          telephone: '01234567890',
          dob: '1979-12-01',
          emailConfirmed: false
        }
      ]);
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.profile({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can create a new profile', async () => {
      const params = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'rob.fryer@example.com',
          userId: '12345'
        }
      };

      transaction = await knexInstance.transaction();
      const profile = await this.profile(params, transaction);
      transaction.commit();

      const profileId = profile.id;
      const responseProfile = await models.Profile.query(knexInstance).findById(profileId);

      assert.ok(responseProfile);
      assert.deepEqual(responseProfile.firstName, params.data.firstName);
      assert.deepEqual(responseProfile.lastName, params.data.lastName);
      assert.deepEqual(responseProfile.userId, params.data.userId);
    });

    it('updates the userId if it finds an existing profile', async () => {
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

      transaction = await knexInstance.transaction();
      const newProfile = await this.profile(params, transaction);
      transaction.commit();

      transaction = await knexInstance.transaction();
      await this.profile(params2, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(newProfile.id);

      assert.ok(profile);
      assert.deepEqual(profile.firstName, params.data.firstName);
      assert.deepEqual(profile.lastName, params.data.lastName);
      assert.deepEqual(profile.userId, params2.data.userId);
    });

    it('sends a confirm email message if address is not already confirmed', async () => {
      const params = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'rob.fryer@example.com',
          userId: '12345'
        }
      };

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      assert.ok(emailer.sendEmail.calledOnce);
      assert.equal(emailer.sendEmail.lastCall.args[0].template, 'confirm-email');
    });

    it('does not send a confirm email message if address is already confirmed', async () => {
      const params = {
        action: 'create',
        data: {
          firstName: 'Robert',
          lastName: 'Fryer',
          email: 'rob.fryer@example.com',
          userId: '12345',
          emailConfirmed: true
        }
      };

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      assert.ok(!emailer.sendEmail.called);
    });
  });

  describe('updateLastLogin', () => {
    it('sets the login datetime to current datetime', async () => {
      const params = {
        action: 'updateLastLogin',
        id: ID_1
      };

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const profile = models.Profile.query(knexInstance).findById(ID_1);
      assert.ok(isNowish(profile.lastLogin));
    });
  });

  describe('Merge', () => {
    beforeEach(async () => {

      await models.Establishment.query(knexInstance).insert([
          {
            id: EST_1,
            name: 'Univerty of Croydon'
          },
          {
            id: EST_2,
            name: 'Marvell Pharmaceutical'
          }
        ]);

      await models.Profile.query(knexInstance).insert({
          id: ID_2,
          firstName: 'Cyril',
          lastName: 'Figgis',
          email: 'cyril@figgis.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        });
    });

    it('throws an error if profiles to be merged both have active PILs', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      await models.PIL.query(knexInstance).insert([
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
        ]);
        try {
          transaction = await knexInstance.transaction();
          await this.profile(params, transaction);
        } catch (err) {
          assert.equal(err.message, 'Cannot merge profiles as both have an active PIL', 'error not thrown');
        } finally {
          transaction.commit();
        }
    });

    it('transfers permissions from profile to target', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      await models.Permission.query(knexInstance).insert([
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
        ]).returning('*');

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const queryPermissionsProfile2 = await models.Permission.query(knexInstance).where({ profileId: ID_2 });
      assert.equal(queryPermissionsProfile2.length, 2, 'Permissions were not transferred to profile 2');

      const permission1 = queryPermissionsProfile2.find(p => p.establishmentId === EST_1);
      const permission2 = queryPermissionsProfile2.find(p => p.establishmentId === EST_2);
      assert.equal(permission1.role, 'admin', 'Profile 2 was not made an admin at establishment 1');
      assert.equal(permission2.role, 'read', 'Profile 2 was not made readonly at establishment 2');

      const queryPermissionsProfile1 = await models.Permission.query(knexInstance).where({ profileId: ID_1 });
      assert.equal(queryPermissionsProfile1.length, 0, 'Permissions were not removed from profile 1');
    });

    it('transfers permissions if both profiles have permissions at the establishment', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      transaction = await knexInstance.transaction();
      await models.Permission.query(knexInstance).insert([
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
        ]).returning('*');

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const queryPermissionsProfile2 = await models.Permission.query(knexInstance).where({ profileId: ID_2 });
      assert.equal(queryPermissionsProfile2.length, 1, 'duplicate permission copied over');

      const queryPermissionsProfile1 = await models.Permission.query(knexInstance).where({ profileId: ID_1 });
      assert.equal(queryPermissionsProfile1.length, 0, 'permission not removed from profile 1');
    });
    it('transfers over the other relations to target', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      // Step 1: Insert initial data
      await Promise.all([
        models.Project.query(knexInstance).insert({ licenceHolderId: ID_1, establishmentId: EST_1 }),
        models.PIL.query(knexInstance).insert({ profileId: ID_1, establishmentId: EST_1 }),
        models.Role.query(knexInstance).insert({ profileId: ID_1, establishmentId: EST_1, type: 'nacwo' }),
        models.Certificate.query(knexInstance).insert({ profileId: ID_1 }),
        models.Exemption.query(knexInstance).insert({ profileId: ID_1, module: 'L' })
      ]);

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const removedModels = await Promise.all([
        models.Project.query(knexInstance).where({ licenceHolderId: ID_1 }),
        models.PIL.query(knexInstance).where({ profileId: ID_1 }),
        models.Role.query(knexInstance).where({ profileId: ID_1 }),
        models.Certificate.query(knexInstance).where({ profileId: ID_1 }),
        models.Exemption.query(knexInstance).where({ profileId: ID_1 })
      ]);

      removedModels.forEach(model => {
        assert.equal(model.length, 0, 'model was not removed from profile 1');
      });

      const transferredModels = await Promise.all([
        models.Project.query(knexInstance).where({ licenceHolderId: ID_2 }),
        models.PIL.query(knexInstance).where({ profileId: ID_2 }),
        models.Role.query(knexInstance).where({ profileId: ID_2 }),
        models.Certificate.query(knexInstance).where({ profileId: ID_2 }),
        models.Exemption.query(knexInstance).where({ profileId: ID_2 })
      ]);

      transferredModels.forEach(model => {
        assert.equal(model.length, 1, 'model was not transferred to profile 2');
      });
    });

    it('transfers all roles to the target and prevents them from being duplicated', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      await models.Role.query(knexInstance).insert([
            { profileId: ID_1, establishmentId: EST_1, type: 'holc' },
            { profileId: ID_1, establishmentId: EST_1, type: 'nacwo' },
            { profileId: ID_2, establishmentId: EST_1, type: 'nacwo' }, // both profiles have nacwo role at est1
            { profileId: ID_2, establishmentId: EST_2, type: 'nacwo' }
          ]);

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

     const queryRolesProfile1 = await models.Role.query(knexInstance).where({ profileId: ID_1 });
     assert(queryRolesProfile1.length === 0, 'all roles should be removed from the source profile');

     const queryRolesProfile2 = await models.Role.query(knexInstance).where({ profileId: ID_2 });
      assert(queryRolesProfile2.length === 3, 'the target profile should have three roles total');
      assert(queryRolesProfile2.find(r => r.establishmentId === EST_1 && r.type === 'holc'), 'target is now holc at establishment 1');
      assert(queryRolesProfile2.find(r => r.establishmentId === EST_1 && r.type === 'nacwo'), 'target retains nacwo at establishment 1');
      assert(queryRolesProfile2.filter(r => r.establishmentId === EST_1 && r.type === 'nacwo').length === 1, 'only a single nacwo role for target at establishment 1');
      assert(queryRolesProfile2.find(r => r.establishmentId === EST_2 && r.type === 'nacwo'), 'target retains nacwo at establishment 2');
    });

    it('transfers pil licence number to target profile if target profile has no PIL number', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };
      await models.Profile.query(knexInstance).patch({ pilLicenceNumber: 'abc' }).where({ id: ID_1 });

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_2);
      assert.equal(profile.pilLicenceNumber, 'abc');
    });

    it('leaves pil licence number intact on target profile', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      await models.PIL.query(knexInstance).insert([
            { profileId: ID_1, licenceNumber: null, status: 'active', establishmentId: EST_1 },
            { profileId: ID_2, licenceNumber: null, status: 'inactive', establishmentId: EST_2 }
          ]);

      await models.Profile.query(knexInstance).patch({ pilLicenceNumber: 'abc' }).where({ id: ID_1 });

      await models.Profile.query(knexInstance).patch({ pilLicenceNumber: 'def' }).where({ id: ID_2 });

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_2);
      assert.equal(profile.pilLicenceNumber, 'def');
    });

    it('leaves pil licence number on target profile if neither are active', async () => {
      const params = {
        action: 'merge',
        data: {
          target: ID_2
        },
        id: ID_1
      };

      await models.PIL.query(knexInstance).insert([
            { profileId: ID_1, licenceNumber: 'abc', status: 'inactive', establishmentId: EST_1 },
            { profileId: ID_2, licenceNumber: 'def', status: 'revoked', establishmentId: EST_2 }
          ]);

      await models.Profile.query(knexInstance).patch({ pilLicenceNumber: 'abc' }).where({ id: ID_1 });

      await models.Profile.query(knexInstance).patch({ pilLicenceNumber: 'def' }).where({ id: ID_2 });

      transaction = await knexInstance.transaction();
      await this.profile(params, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_2);
      assert.equal(profile.pilLicenceNumber, 'def');
    });

  });

  describe('Update', () => {
    it('can update a profile model', async () => {
      const opts = {
        action: 'update',
        data: {
          firstName: 'Vincent',
          lastName: 'Malloy'
        },
        id: ID_1
      };

      transaction = await knexInstance.transaction();
      await this.profile(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_1);
      assert.ok(profile);
      assert.deepEqual(profile.firstName, opts.data.firstName);
      assert.deepEqual(profile.lastName, opts.data.lastName);
    });

    it('ignores superfluous params, can update a profile model', async () => {
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

      transaction = await knexInstance.transaction();
      await this.profile(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_1);
      assert.ok(profile);
      assert.deepEqual(profile.comments, undefined);
      assert.deepEqual(profile.someField, undefined);
    });

    describe('email address', () => {

      it('returns the profile', async () => {
        const opts = {
          action: 'update',
          data: {
            email: 'test@example.com'
          },
          id: ID_1
        };

        transaction = await knexInstance.transaction();
        const profile = await this.profile(opts, transaction);
        transaction.commit();

        assert.ok(profile);
        assert.deepEqual(profile.id, ID_1);
      });

    });

  });

  describe('Confirm email', () => {

    it('marks the emailConfirmed property on the profile as true', async () => {
      const opts = {
        action: 'confirm-email',
        data: {},
        id: ID_1
      };

      transaction = await knexInstance.transaction();
      await this.profile(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ID_1);
      assert.equal(profile.emailConfirmed, true);
    });

  });

  describe('Resend email', () => {

    it('sends a new confirmation email', async () => {
      const opts = {
        action: 'resend-email',
        data: {},
        id: ID_1
      };

      transaction = await knexInstance.transaction();
      await this.profile(opts, transaction);
      transaction.commit();

      await models.Profile.query(knexInstance).findById(ID_1);
      assert.ok(emailer.sendEmail.calledOnce);
      assert.equal(emailer.sendEmail.lastCall.args[0].template, 'confirm-email');
    });

  });
});
