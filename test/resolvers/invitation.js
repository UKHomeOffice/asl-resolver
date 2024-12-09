const assert = require('assert');
const { invitation } = require('../../lib/resolvers');
const db = require('../helpers/db');
const jwt = require('../../lib/jwt');
const emailer = require('../helpers/emailer');

const INVITATION_ID = 'e7296c40-6942-49fa-b695-7ea16b90f037';

describe('Invitation resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.jwt = jwt({ secret: 'hunter2' });
    this.invitation = invitation({
      jwt: this.jwt,
      emailer,
      models: models
    });

  });

  beforeEach(async () => {
    await emailer.sendEmail.resetHistory();

    await db.clean(models);

    await models.Establishment.query(knexInstance).insert({
        id: 8201,
        name: 'University of life',
        country: 'england',
        address: '123 example street',
        email: 'test@asd.com'
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('fails with an error if unexpected action received', async () => {
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

    it('creates an invitation model', async () => {
      transaction = await knexInstance.transaction();
      await this.invitation({ action: 'create', data }, transaction);
      transaction.commit();

      const invitations = await models.Invitation.query(knexInstance);
      assert.equal(invitations.length, 1, 'Invitation model exists in database');
      assert.equal(invitations[0].email, 'test@example.com');
      assert.equal(invitations[0].establishmentId, 8201);
      assert.equal(invitations[0].role, 'admin');
    });

    it('creates a jwt token with email, establishment and role', async () => {
      transaction = await knexInstance.transaction();
      await this.invitation({ action: 'create', data }, transaction);
      transaction.commit();

      const invitations = await models.Invitation.query(knexInstance);
      const token = await this.jwt.verify(invitations[0].token);
      assert.equal(token.email, 'test@example.com');
      assert.equal(token.establishmentId, 8201);
      assert.equal(token.role, 'admin');
    });

    it('updates invitation model if one already exists', async () => {
      await models.Invitation.query(knexInstance).insert({
          id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf',
          establishmentId: 8201,
          token: 'abc123',
          email: 'test@example.com',
          role: 'admin'
        });

      transaction = await knexInstance.transaction();
      await this.invitation({ action: 'create', data }, transaction);
      transaction.commit();

      const invitations = await models.Invitation.query(knexInstance);
      assert.equal(invitations.length, 1, 'Only one Invitation model exists in database');
      assert.notEqual(invitations[0].token, 'abc123', 'Invitation token has been updated with new expiry');
    });

    it('Undeletes invitation model if deleted exists', async () => {
      await models.Invitation.query(knexInstance).insert({
          establishmentId: 8201,
          token: 'abc123',
          email: 'test@example.com',
          role: 'admin',
          deleted: (new Date()).toISOString()
        });

      transaction = await knexInstance.transaction();
      await this.invitation({ action: 'create', data }, transaction);
      transaction.commit();

      const invitations = await models.Invitation.query(knexInstance);
      assert.equal(invitations.length, 1, 'Only one Invitation model exists in database');
      assert.notEqual(invitations[0].token, 'abc123', 'Invitation token has been updated with new expiry');
    });

    it('sends email containing link to accept invitation', async () => {
      transaction = await knexInstance.transaction();
      const [{ state: { token } }] = await this.invitation({ action: 'create', data }, transaction);
      transaction.commit();
      assert.ok(token);
      assert.ok(emailer.sendEmail.calledOnce, 'One email has been sent');
      assert.equal(emailer.sendEmail.lastCall.args[0].email, 'test@example.com');
    });

  });

  describe('Accept', () => {
    let model;

    beforeEach(async () => {
      model = {
        profileId: 'ec2160d0-1778-4891-ba44-6ff1d2df4c8c',
        establishmentId: 8201,
        role: 'admin'
      };

      await db.clean(models);

      await models.Profile.query(knexInstance).insert([
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
        ]);

      await models.Establishment.query(knexInstance).insert({
          id: 8201,
          name: 'An establishment',
          country: 'england',
          address: '123 example street',
          email: 'test@example.com'
        });

      await models.Invitation.query(knexInstance).returning('*').insert([
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
        ]);
    });

    const data = {
      action: 'accept'
    };

    it('sets a permission model', async () => {
      transaction = await knexInstance.transaction();
      await this.invitation({
          ...data,
          data: {
            profileId: model.profileId,
            id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf'
          }
        }, transaction);
      transaction.commit();

      const permissions = await models.Permission.query(knexInstance).where({
          establishmentId: model.establishmentId,
          profileId: model.profileId
        });
        assert.deepEqual(permissions.length, 1);
        assert.deepEqual(permissions[0].profileId, model.profileId);
        assert.deepEqual(permissions[0].establishmentId, model.establishmentId);
        assert.deepEqual(permissions[0].role, model.role);
    });

    it('deletes the invitation model', async () => {
      const PendingInvitation = await models.Invitation.query(knexInstance).findById('ea54044f-79a2-49a9-a2e3-998e6206c3cf');
        assert.ok(PendingInvitation, 'Invitation exists in the database');

      transaction = await knexInstance.transaction();
      await this.invitation({
          ...data,
          data: {
            profileId: model.profileId,
            id: 'ea54044f-79a2-49a9-a2e3-998e6206c3cf'
          }
        }, transaction);
      transaction.commit();

      const invitation = await models.Invitation.query(knexInstance).findById('ea54044f-79a2-49a9-a2e3-998e6206c3cf');
      assert.ok(!invitation, 'Invitation has been removed from the database');
    });
  });

  describe('cancel, resend & delete', () => {
    beforeEach(async () => {
    await models.Invitation.query(knexInstance).insert({
        id: INVITATION_ID,
        establishmentId: 8201,
        token: 'abc123',
        email: 'testy@mctestface.com',
        role: 'admin'
      });
    });

    describe('cancel', () => {
      it('sets the token to null', async () => {
        const params = {
          action: 'cancel',
          id: INVITATION_ID
        };

        transaction = await knexInstance.transaction();
        await this.invitation(params, transaction);
        transaction.commit();

        const invitation = await models.Invitation.query(knexInstance).findById(INVITATION_ID);
        assert.equal(invitation.token, null);
      });
    });

    describe('delete', () => {
      it('soft deletes the invitation', async () => {
        const params = {
          action: 'delete',
          id: INVITATION_ID
        };

        transaction = await knexInstance.transaction();
        await this.invitation(params, transaction);
        transaction.commit();

        const invitation = await models.Invitation.queryWithDeleted(knexInstance).findById(INVITATION_ID);
        assert.ok(invitation.deleted);
      });
    });

    describe('resend', () => {
      beforeEach(async () => {
        await models.Invitation.query(knexInstance).findById(INVITATION_ID).patch({ token: null });
      });

      it('updates the token and resends the email', async () => {
        const params = {
          action: 'resend',
          id: INVITATION_ID
        };
        transaction = await knexInstance.transaction();
        await this.invitation(params, transaction);
        transaction.commit();

        const invitation = await models.Invitation.query(knexInstance).findById(INVITATION_ID);
        assert.ok(invitation.token);
        assert.ok(emailer.sendEmail.calledOnce, 'One email has been sent');
        assert.equal(emailer.sendEmail.lastCall.args[0].email, 'testy@mctestface.com');
      });
    });
  });
});
