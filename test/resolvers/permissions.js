const assert = require('assert');
const uuid = require('uuid/v4');
const { permission } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PROFILE = uuid();
const PROFILE2 = uuid();

describe('Permissions resolver', () => {
  before(() => {
    this.models = db.init();
    this.permissions = permission({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Profile.query().insert([
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
      ]))
      .then(() => this.models.Establishment.query().insert([
        {
          id: 100,
          name: 'Test University'
        },
        {
          id: 101,
          name: 'Other University'
        }
      ]))
      .then(() => this.models.Permission.query().insert([
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
      ]).returning('*'))
      .then(() => this.models.Project.query().insert([
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
      ]));
  });

  after(() => {
    return this.models.destroy();
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

    it('can update an association', () => {
      const opts = {
        action: 'update',
        data: {
          role: 'admin',
          establishmentId: 100,
          profileId: PROFILE
        }
      };
      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Permission.query().where({ establishmentId: 100, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].establishmentId, 100);
          assert.equal(associations[0].profileId, PROFILE);
          assert.equal(associations[0].role, 'admin');
        });
    });

    it('updates the association with the correct establishment', () => {
      const opts = {
        action: 'update',
        data: {
          establishmentId: 101,
          profileId: PROFILE,
          role: 'admin'
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Permission.query().where({ establishmentId: 100, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].role, 'basic');
        })
        .then(() => this.models.Permission.query().where({ establishmentId: 101, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].role, 'admin');
        });
    });

  });

  describe('Delete', () => {
    it('can delete an association', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Permission.query().where({ establishmentId: 100, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 0);
        });
    });

    it('deletes the association with the correct establishment', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 101,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Permission.query().where({ establishmentId: 101, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 0);
        })
        .then(() => this.models.Permission.query().where({ establishmentId: 100, profileId: PROFILE }))
        .then(associations => {
          assert.equal(associations.length, 1);
          assert.equal(associations[0].role, 'basic');
        });
    });

    it('removes draft projects held by the user at the establishment', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Project.query().where({ establishmentId: 100, licenceHolderId: PROFILE }))
        .then(projects => {
          assert.ok(!projects.map(p => p.title).includes('Draft'));
        });
    });

    it('does not remove draft projects held by the user at other establishments', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Project.query().where({ establishmentId: 101, licenceHolderId: PROFILE }))
        .then(projects => {
          assert.ok(projects.map(p => p.title).includes('Draft other establishment'));
        });
    });

    it('does not remove active projects held by the user at the establishment', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Project.query().where({ establishmentId: 100, licenceHolderId: PROFILE }))
        .then(projects => {
          assert.ok(projects.map(p => p.title).includes('Active'));
        });
    });

    it('does not remove draft projects held by other users at the establishment', () => {
      const opts = {
        action: 'delete',
        data: {
          establishmentId: 100,
          profileId: PROFILE
        }
      };

      return Promise.resolve()
        .then(() => this.permissions(opts))
        .then(() => this.models.Project.query().where({ establishmentId: 100, licenceHolderId: PROFILE2 }))
        .then(projects => {
          assert.ok(projects.map(p => p.title).includes('Draft other user'));
        });
    });
  });

});
