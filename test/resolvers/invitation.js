const assert = require('assert');
const { invitation } = require('../../lib/resolvers');
const db = require('../helpers/db');
const jwt = require('../../lib/jwt');
const emailer = require('../helpers/emailer');

const INVITATION_ID = 'e7296c40-6942-49fa-b695-7ea16b90f037';

describe('Invitation resolver', () => {
  before(() => {
    this.models = db.init();
    this.jwt = jwt({ secret: 'hunter2' });
    this.invitation = invitation({
      jwt: this.jwt,
      emailer,
      models: this.models
    });

  });

  beforeEach(() => {
    emailer.sendEmail.resetHistory();

    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert({
        id: 8201,
        name: 'University of life',
        country: 'england',
        address: '123 example street',
        email: 'test@asd.com'
      }));
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
    const data = {
      email: 'test@example.com',
      firstName: 'Vincent',
      lastName: 'Malloy',
      establishmentId: 8201,
      role: 'admin'
    };

    it('creates an invitation model', () => {
      return Promise.resolve()
        .then(() => this.invitation({ action: 'create', data }))
        .then(() => this.models.Invitation.query())
        .then(invitations => {
          assert.equal(invitations.length, 1, 'Invitation model exists in database');
          assert.equal(invitations[0].email, 'test@example.com');
          assert.equal(invitations[0].establishmentId, 8201);
          assert.equal(invitations[0].role, 'admin');
        });
    });

    it('creates a jwt token with email, establishment and role', () => {
      return Promise.resolve()
        .then(() => this.invitation({ action: 'create', data }))
        .then(() => this.models.Invitation.query())
        .then(async invitations => {
          const token = await this.jwt.verify(invitations[0].token);
          assert.equal(token.email, 'test@example.com');
          assert.equal(token.establishmentId, 8201);
          assert.equal(token.role, 'admin');
        });
    });

    it('updates invitation model if one already exists', () => {
      return Promise.resolve()
        .then(() => this.models.Invitation.query().insert({
          id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf',
          establishmentId: 8201,
          token: 'abc123',
          email: 'test@example.com',
          role: 'admin'
        }))
        .then(() => this.invitation({ action: 'create', data }))
        .then(() => this.models.Invitation.query())
        .then(invitations => {
          assert.equal(invitations.length, 1, 'Only one Invitation model exists in database');
          assert.notEqual(invitations[0].token, 'abc123', 'Invitation token has been updated with new expiry');
        });
    });

    it('Undeletes invitation model if deleted exists', () => {
      return Promise.resolve()
        .then(() => this.models.Invitation.query().insert({
          establishmentId: 8201,
          token: 'abc123',
          email: 'test@example.com',
          role: 'admin',
          deleted: (new Date()).toISOString()
        }))
        .then(() => this.invitation({ action: 'create', data }))
        .then(() => this.models.Invitation.query())
        .then(invitations => {
          assert.equal(invitations.length, 1, 'Only one Invitation model exists in database');
          assert.notEqual(invitations[0].token, 'abc123', 'Invitation token has been updated with new expiry');
        });
    });

    it('sends email containing link to accept invitation', () => {
      return Promise.resolve()
        .then(() => this.invitation({ action: 'create', data }))
        .then(invitations => {
          assert.ok(emailer.sendEmail.calledOnce, 'One email has been sent');
          assert.equal(emailer.sendEmail.lastCall.args[0].email, 'test@example.com');
        });
    });

  });

  describe('Accept', () => {
    let model;

    beforeEach(() => {
      model = {
        profileId: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
        establishmentId: 8201,
        role: 'admin'
      };

      return Promise.resolve()
        .then(() => db.clean(this.models))
        .then(() => this.models.Profile.query().insert([
          {
            id: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
            firstName: 'Testy',
            lastName: 'McTestface',
            email: 'test@test.com'
          },
          {
            id: '221d08a3-3f9b-4167-ae64-368271569952',
            firstName: 'Vincent',
            lastName: 'Malloy',
            email: 'vincent@price.com'
          },
          {
            id: '345b1f16-1f00-49f7-bf47-6fdf237ca73f',
            firstName: 'Sterling',
            lastName: 'Archer',
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
            id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf',
            establishmentId: 8201,
            token: 'abc123',
            email: 'test@example.com',
            role: 'admin'
          }, {
            id: 'eb688b52-e690-43b7-a956-73bc11788b0f',
            establishmentId: 8201,
            token: 'def456',
            email: 'test@example.com',
            role: 'read'
          }, {
            id: 'cb484606-9318-4645-9894-8ab153d51e44',
            establishmentId: 8201,
            token: 'ghi789',
            email: 'test@example.com',
            role: 'basic'
          }
        ]));
    });

    const data = {
      action: 'accept'
    };

    it('sets a permission model', () => {
      return Promise.resolve()
        .then(() => this.invitation({
          ...data,
          data: {
            profileId: model.profileId,
            id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf'
          }
        }))
        .then(() => this.models.Permission.query().where({
          establishmentId: model.establishmentId,
          profileId: model.profileId
        }))
        .then(permissions => {
          assert.deepEqual(permissions.length, 1);
          assert.deepEqual(permissions[0].profileId, model.profileId);
          assert.deepEqual(permissions[0].establishmentId, model.establishmentId);
          assert.deepEqual(permissions[0].role, model.role);
        });
    });

    it('deletes the invitation model', () => {
      return Promise.resolve()
        .then(() => this.models.Invitation.query().findById('ea54044f-79a2-49a9-a2e3-998e6206c3cf'))
        .then(invitation => {
          assert.ok(invitation, 'Invitation exists in the database');
        })
        .then(() => this.invitation({
          ...data,
          data: {
            profileId: model.profileId,
            id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf'
          }
        }))
        .then(() => this.models.Invitation.query().findById('ea54044f-79a2-49a9-a2e3-998e6206c3cf'))
        .then(invitation => {
          assert.ok(!invitation, 'Invitation has been removed from the database');
        });
    });
  });

  describe('cancel, resend & delete', () => {
    beforeEach(() => {
      return this.models.Invitation.query().insert({
        id: INVITATION_ID,
        establishmentId: 8201,
        token: 'abc123',
        email: 'testy@mctestface.com',
        role: 'admin'
      });
    });

    describe('cancel', () => {
      it('sets the token to null', () => {
        const params = {
          action: 'cancel',
          id: INVITATION_ID
        };
        return Promise.resolve()
          .then(() => this.invitation(params))
          .then(() => this.models.Invitation.query().findById(INVITATION_ID))
          .then(invitation => {
            assert.equal(invitation.token, null);
          });
      });
    });

    describe('delete', () => {
      it('soft deletes the invitation', () => {
        const params = {
          action: 'delete',
          id: INVITATION_ID
        };
        return Promise.resolve()
          .then(() => this.invitation(params))
          .then(() => this.models.Invitation.queryWithDeleted().findById(INVITATION_ID))
          .then(invitation => {
            assert.ok(invitation.deleted);
          });
      });
    });

    describe('resend', () => {
      beforeEach(() => {
        return this.models.Invitation.query().findById(INVITATION_ID).patch({ token: null });
      });

      it('updates the token and resends the email', () => {
        const params = {
          action: 'resend',
          id: INVITATION_ID
        };
        return Promise.resolve()
          .then(() => this.invitation(params))
          .then(() => this.models.Invitation.query().findById(INVITATION_ID))
          .then(invitation => {
            assert.ok(invitation.token);
            assert.ok(emailer.sendEmail.calledOnce, 'One email has been sent');
            assert.equal(emailer.sendEmail.lastCall.args[0].email, 'testy@mctestface.com');
          });
      });
    });
  });
});
