const assert = require('assert');
const uuid = require('uuid/v4');
const { permission } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE = uuid();
const PROFILE2 = uuid();

describe('Permissions resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.permissions = permission({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Profile.query(knexInstance).insert([
        {
          id: PROFILE,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sa@example.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        },
        {
          id: PROFILE2,
          firstName: 'Other',
          lastName: 'User',
          email: 'ou@example.com',
          telephone: '01234567890',
          dob: '1979-12-01'
        }
      ]);

    await models.Establishment.query(knexInstance).insert([
        {
          id: 100,
          name: 'Test University'
        },
        {
          id: 101,
          name: 'Other University'
        }
      ]);

    await models.Permission.query(knexInstance).insert([
        {
          establishmentId: 100,
          profileId: PROFILE,
          role: 'basic'
        },
        {
          establishmentId: 101,
          profileId: PROFILE,
          role: 'basic'
        }
      ]).returning('*');

    await models.Project.query(knexInstance).insert([
        {
          establishmentId: 100,
          licenceHolderId: PROFILE,
          status: 'inactive',
          title: 'Draft',
          version: [
            {
              status: 'draft',
              data: {}
            }
          ]
        },
        {
          establishmentId: 100,
          licenceHolderId: PROFILE2,
          status: 'inactive',
          title: 'Draft other user',
          version: [
            {
              status: 'draft',
              data: {}
            }
          ]
        },
        {
          establishmentId: 101,
          licenceHolderId: PROFILE,
          status: 'inactive',
          title: 'Draft other establishment',
          version: [
            {
              status: 'draft',
              data: {}
            }
          ]
        },
        {
          establishmentId: 100,
          licenceHolderId: PROFILE,
          status: 'active',
          title: 'Active',
          version: [
            {
              status: 'granted',
              data: {}
            }
          ]
        }
      ]);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.permissions({ action: 'nope', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: nope/
    });
  });

  describe('Update', () => {

    it('can update an association', async () => {
      const opts = {
        action: 'update',
        data: {
          role: 'admin',
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const associations = await models.Permission.query(knexInstance).where({ establishmentId: 100, profileId: PROFILE });
      assert.equal(associations.length, 1);
      assert.equal(associations[0].establishmentId, 100);
      assert.equal(associations[0].profileId, PROFILE);
      assert.equal(associations[0].role, 'admin');
    });

    it('updates the association with the correct establishment', async () => {
      const opts = {
        action: 'update',
        data: {
          establishmentId: 101,
          profileId: PROFILE,
          role: 'admin'
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const profileHasBasicRole = await models.Permission.query(knexInstance).where({ establishmentId: 100, profileId: PROFILE });
      assert.equal(profileHasBasicRole.length, 1);
      assert.equal(profileHasBasicRole[0].role, 'basic');

      const profileHasAdminRole = await models.Permission.query(knexInstance).where({ establishmentId: 101, profileId: PROFILE });
      assert.equal(profileHasAdminRole.length, 1);
      assert.equal(profileHasAdminRole[0].role, 'admin');
    });

  });

  describe('Delete', () => {
    it('can delete an association', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const associations = await models.Permission.query(knexInstance).where({ establishmentId: 100, profileId: PROFILE });
      assert.equal(associations.length, 0);
    });

    it('deletes the association with the correct establishment', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 101,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const deletePermissionOnEstablishment101 = await models.Permission.query(knexInstance).where({ establishmentId: 101, profileId: PROFILE });

      assert.equal(deletePermissionOnEstablishment101.length, 0);

      const profileHasBasicPermissionOnEstablishment100 = await models.Permission.query(knexInstance).where({ establishmentId: 100, profileId: PROFILE });

      assert.equal(profileHasBasicPermissionOnEstablishment100.length, 1);
      assert.equal(profileHasBasicPermissionOnEstablishment100[0].role, 'basic');
    });

    it('removes draft projects held by the user at the establishment', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const projects = await models.Project.query(knexInstance).where({ establishmentId: 100, licenceHolderId: PROFILE });
      assert.ok(!projects.map(p => p.title).includes('Draft'));
    });

    it('does not remove draft projects held by the user at other establishments', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const projects = await models.Project.query(knexInstance).where({ establishmentId: 101, licenceHolderId: PROFILE });
      assert.ok(projects.map(p => p.title).includes('Draft other establishment'));
    });

    it('does not remove active projects held by the user at the establishment', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const projects = await models.Project.query(knexInstance).where({ establishmentId: 100, licenceHolderId: PROFILE });
      assert.ok(projects.map(p => p.title).includes('Active'));
    });

    it('does not remove draft projects held by other users at the establishment', async () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      transaction = await knexInstance.transaction();
      await this.permissions(opts, transaction);
      transaction.commit();

      const projects = await models.Project.query(knexInstance).where({ establishmentId: 100, licenceHolderId: PROFILE2 });
      assert.ok(projects.map(p => p.title).includes('Draft other user'));
    });
  });

});
