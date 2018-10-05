const assert = require('assert');
const { invitation } = require('../../lib/resolvers');
const db = require('../helpers/db');
const keycloak = require('../helpers/keycloak');
const jwt = require('../helpers/jwt');
const emailer = require('../helpers/emailer');

describe('Invitation resolver', () => {
  before(() => {
    this.models = db.init();
    this.invitation = invitation({
      jwt,
      keycloak,
      emailer,
      models: this.models
    });
  });

  beforeEach(() => {
    keycloak.ensureUser.resetHistory();
    keycloak.setUserPassword.resetHistory();
    jwt.sign.resetHistory();
    jwt.verify.resetHistory();
    emailer.sendEmail.resetHistory();

    return db.clean(this.models);
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  it('fails with an error if unexpected action received', () => {
    const action = 'doSomething';
    return assert.rejects(() => {
      return this.invitation({ action });
    }, {
      name: 'Error',
      message: `Unknown action: ${action}`
    });
  });

  describe('Create', () => {
    beforeEach(() => {
      return this.models.Establishment.query().insertGraph({
        id: 8201,
        name: 'University of life',
        country: 'england',
        address: '123 example street',
        email: 'test@asd.com',
        profiles: [{
          id: '221d08a3-3f9b-4167-ae64-368271569952',
          first_name: 'Vincent',
          last_name: 'Malloy',
          email: 'vincent@price.com'
        }]
      });
    });

    describe('Existing profile', () => {
      const data = {
        email: 'vincent@price.com',
        first_name: 'Vincent',
        last_name: 'Malloy',
        establishment: 8201,
        role: 'admin'
      };

      it('Adds user to keycloak if they don\'t have a user_id', () => {
        return Promise.resolve()
          .then(() => this.invitation({ action: 'create', data }))
          .then(() => this.models.Profile.query())
          .then(profiles => {
            assert.deepEqual(profiles.length, 1);
            assert.deepEqual(keycloak.ensureUser.callCount, 1);
            assert.deepEqual(jwt.sign.callCount, 1);
            assert(keycloak.ensureUser.calledWith(data));
          });
      });

      it('Doesn\'t add user to keycloak if they have a user_id', () => {
        return Promise.resolve()
          .then(() => this.models.Profile.query()
            .findById('221d08a3-3f9b-4167-ae64-368271569952')
            .patch({ user_id: '345b1f16-1f00-49f7-bf47-6fdf237ca73f' })
          )
          .then(() => this.invitation({ action: 'create', data }))
          .then(() => this.models.Profile.query())
          .then(profiles => {
            assert.deepEqual(profiles.length, 1);
            assert.deepEqual(keycloak.ensureUser.callCount, 0);
            assert.deepEqual(jwt.sign.callCount, 1);
          });
      });

      it('Creates an invitation model', () => {
        return Promise.resolve()
          .then(() => this.invitation({ action: 'create', data }))
          .then(() => this.models.Invitation.query())
          .then(invitations => {
            assert.deepEqual(invitations.length, 1);
            assert.deepEqual(invitations[0].profile_id, '221d08a3-3f9b-4167-ae64-368271569952');
            assert.deepEqual(invitations[0].establishment_id, data.establishment);
          });
      });

      it('Sends an email and passes the JWT', () => {
        return Promise.resolve()
          .then(() => this.invitation({ action: 'create', data }))
          .then(() => {
            assert.deepEqual(emailer.sendEmail.callCount, 1);
            assert.deepEqual(emailer.sendEmail.args[0][0].token, 'A TOKEN');
          });
      });
    });

    describe('New profile', () => {
      const data = {
        email: 'new@user.com',
        first_name: 'Testy',
        last_name: 'McTestface',
        establishment: 8201,
        role: 'admin'
      };

      it('Adds a new Profile model if user not found', () => {
        return Promise.resolve()
          .then(() => this.invitation({ action: 'create', data }))
          .then(() => this.models.Profile.query())
          .then(profiles => {
            assert.deepEqual(profiles.length, 2);
            assert.deepEqual(keycloak.ensureUser.callCount, 1);
            assert.deepEqual(emailer.sendEmail.callCount, 1);
            assert.deepEqual(emailer.sendEmail.args[0][0].token, 'A TOKEN');
          });
      });
    });
  });

  describe('Resolve', () => {
    let model;

    beforeEach(() => {
      model = {
        profile_id: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
        establishment_id: 8201,
        role: 'admin'
      };
      jwt.verify.resolves(model);

      return Promise.resolve()
        .then(() => this.models.Profile.query().insert([
          {
            id: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
            first_name: 'Testy',
            last_name: 'McTestface',
            email: 'test@test.com'
          },
          {
            id: '221d08a3-3f9b-4167-ae64-368271569952',
            first_name: 'Vincent',
            last_name: 'Malloy',
            email: 'vincent@price.com'
          },
          {
            id: '345b1f16-1f00-49f7-bf47-6fdf237ca73f',
            first_name: 'Sterling',
            last_name: 'Archer',
            email: 'sterling@archer.com'
          }
        ]))
        .then(() => this.models.Establishment.query().insert({
          id: 8201,
          name: 'An establishment',
          country: 'england',
          address: '123 example street',
          email: 'test@example.com'
        }))
        .then(() => this.models.Invitation.query().returning('*').insert([
          {
            establishment_id: 8201,
            profile_id: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
            role: 'admin'
          }, {
            establishment_id: 8201,
            profile_id: '221d08a3-3f9b-4167-ae64-368271569952',
            role: 'read'
          }, {
            establishment_id: 8201,
            profile_id: '345b1f16-1f00-49f7-bf47-6fdf237ca73f',
            role: 'basic'
          }
        ]));
    });

    const data = {
      action: 'resolve'
    };

    it('verifies the JWT token', () => {
      return Promise.resolve()
        .then(() => this.invitation({ ...data, data: { token: 'A TOKEN' } }))
        .then(() => {
          assert.deepEqual(jwt.verify.callCount, 1);
          assert.deepEqual(keycloak.setUserPassword.callCount, 0);
        });
    });

    it('verifies the JWT token', () => {
      return Promise.resolve()
        .then(() => this.invitation({
          ...data,
          data: {
            token: 'A TOKEN',
            password: 'password123'
          }
        }))
        .then(() => {
          assert.deepEqual(keycloak.setUserPassword.callCount, 1);
        });
    });

    it('sets a permission model', () => {
      return Promise.resolve()
        .then(() => this.invitation({ ...data, data: { token: 'A TOKEN' } }))
        .then(() => this.models.Permission.query().where({
          establishment_id: model.establishment_id,
          profile_id: model.profile_id
        }))
        .then(permissions => {
          assert.deepEqual(permissions.length, 1);
          assert.deepEqual(permissions[0].profile_id, model.profile_id);
          assert.deepEqual(permissions[0].establishment_id, model.establishment_id);
          assert.deepEqual(permissions[0].role, model.role);
        });
    });

    it('deletes the invitation model', () => {
      return Promise.resolve()
        .then(() => this.models.Invitation.query().where({
          establishment_id: model.establishment_id,
          profile_id: model.profile_id
        }))
        .then(invitations => {
          assert.deepEqual(invitations.length, 1);
        })
        .then(() => this.invitation({ ...data, data: { token: 'A TOKEN' } }))
        .then(() => this.models.Invitation.query().where({
          establishment_id: model.establishment_id,
          profile_id: model.profile_id
        }))
        .then(invitations => {
          assert.deepEqual(invitations.length, 0);
        });
    });
  });
});
