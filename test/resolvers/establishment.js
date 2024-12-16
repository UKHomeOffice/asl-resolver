const assert = require('assert');
const moment = require('moment');
const { establishment } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

const nowish = (a, b, n = 3) => {
  const diff = moment(a).diff(b, 'seconds');
  return Math.abs(diff) < n;
};

const REMINDER_ID = uuid();
const PROFILE_ID_1 = uuid();
const PROFILE_ID_2 = uuid();

const reminder = {
  id: REMINDER_ID,
  deadline: '2022-07-30',
  modelType: 'establishment',
  status: 'active'
};

const anEstablishment = ({
  id = 8201,
  name = 'University of Croydon',
  updatedAt = '2019-01-01T10:38:43.666Z',
  corporateStatus = 'non-profit',
  legalName = undefined,
  legalPhone = undefined,
  legalEmail = undefined
}) => {
  return {
    id,
    name,
    updatedAt,
    corporateStatus,
    legalName,
    legalPhone,
    legalEmail
  };
};

const aProfile = (id) => {
  return {
    id: id,
    firstName: 'Profile',
    lastName: `${id}`,
    email: `profile_${id}@example.com`
  };
};

const aRole = ({ establishmentId = 8201, profileId, type }) => {
  return {
    establishmentId,
    profileId,
    type
  };
};

describe('Establishment resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.establishment = establishment({ models });
  });

  beforeEach(async () => {
    await db.clean(models);
  });

  after(async () => {
    await db.clean(models);
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.establishment({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert an establishment', async () => {
      const opts = {
        action: 'create',
        data: {
          name: 'New establishment'
        }
      };
      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      await transaction.commit();

      const establishments = await models.Establishment.query(knexInstance);
      const establishment = establishments[0];

      assert.ok(establishment);
      assert.deepEqual(establishment.name, opts.data.name);
      assert.deepEqual(establishment.status, 'inactive');
    });
  });

  describe('Grant', () => {
    it('can grant a licence', async () => {
      await models.Establishment.query(knexInstance).insert({
        id: 101,
        name: 'Research 101',
        status: 'inactive'
      });

      const opts = {
        id: 101,
        action: 'grant',
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishments = await models.Establishment.query(knexInstance);
      const establishment = establishments[0];

      assert.ok(establishment.licenceNumber, 'has a generated licence number');
      assert.deepEqual(establishment.status, 'active', 'status has been changed to active');
      assert(establishment.issueDate, 'has an issue date');
      assert(moment(establishment.issueDate).isValid(), 'issue date is a valid date');
    });
  });

  describe('Revoke', () => {
    it('can revoke an establishment licence', async () => {
      await models.Establishment.query(knexInstance).insert({
        id: 101,
        name: 'Research 101',
        status: 'active'
      });

      const opts = {
        id: 101,
        action: 'revoke',
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishments = await models.Establishment.query(knexInstance);
      const establishment = establishments[0];

      assert.deepEqual(establishment.status, 'revoked', 'status has been changed to revoked');
      assert(establishment.revocationDate, 'has a revocation date');
      assert(moment(establishment.revocationDate).isValid(), 'revocation date is a valid date');
    });
  });

  describe('Suspend', () => {
    it('can suspend an establishment licence', async () => {
      await models.Establishment.query(knexInstance).insert({
        id: 101,
        name: 'Research 101',
        status: 'active'
      });

      const opts = {
        id: 101,
        action: 'suspend',
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(opts.id);

      assert.ok(establishment.suspendedDate, 'has a suspended date');
      assert.ok(moment(establishment.suspendedDate).isValid(), 'suspended date is a valid date');
    });
  });

  describe('Reinstate', () => {
    it('can reinstate an establishment licence', async () => {
      await models.Establishment.query(knexInstance).insert({
        id: 101,
        name: 'Research 101',
        status: 'active',
        suspendedDate: moment().toISOString()
      });

      const opts = {
        id: 101,
        action: 'reinstate',
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(opts.id);

      assert.ok(!establishment.suspendedDate, 'no longer has a suspended date');

    });

  });

  describe('Update conditions', () => {
    beforeEach(async () => {
      await models.Establishment.query(knexInstance).insert({ id: 101, name: 'Research 101', status: 'active' });
    });

    it('can update the existing conditions', async () => {
      const opts = {
        id: 101,
        action: 'update-conditions',
        data: {
          conditions: 'Some new conditions'
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(101);

      assert.deepEqual(establishment.conditions, 'Some new conditions', 'the conditions should be updated');
    });

    it('can save a new condition reminder', async () => {
      const opts = {
        id: 101,
        action: 'update-conditions',
        data: {
          conditions: 'Some new conditions',
          reminder: {
            deadline: '2022-07-03'
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'establishment', establishmentId: 101 });

      assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
      assert.deepEqual(reminders[0].deadline, '2022-07-03', 'the deadline should be correct');
      assert.deepEqual(reminders[0].status, 'active', 'the status should be active');
      assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
    });

    it('can update an existing condition reminder', async () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'establishment',
        establishmentId: 101,
        status: 'active'
      };

      const responseReminder = await models.Reminder.query(knexInstance).insert(reminder).returning('id');

      const opts = {
        id: 101,
        action: 'update-conditions',
        data: {
          conditions: 'Some new conditions',
          reminder: {
            id: responseReminder.id,
            deadline: '2022-11-22'
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'establishment', establishmentId: 101 });

      assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
      assert.deepEqual(reminders[0].deadline, '2022-11-22', 'the deadline should be updated');
      assert.deepEqual(reminders[0].status, 'active', 'the status should still be active');
      assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
    });

    it('can delete an existing condition reminder', async () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'establishment',
        establishmentId: 101,
        status: 'active'
      };

      const responseReminder = await models.Reminder.query(knexInstance).insert(reminder).returning('id');

          const opts = {
            id: 101,
            action: 'update-conditions',
            data: {
              conditions: 'Some new conditions',
              reminder: {
                id: responseReminder.id,
                deleted: true
              }
            }
          };

          transaction = await knexInstance.transaction();
          await this.establishment(opts, transaction);
          transaction.commit();

          const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'establishment', establishmentId: 101 });

          assert.deepEqual(reminders.length, 0, 'there should be no reminders returned in the standard query');

          const deleteReminders = await models.Reminder.queryWithDeleted(knexInstance).where({
              modelType: 'establishment',
              establishmentId: 101
            });

          assert.deepEqual(deleteReminders.length, 1, 'there should be a single deleted reminder');
          assert.ok(deleteReminders[0].deleted, 'the deleted column should be set');
          assert(moment(deleteReminders[0].deleted).isValid(), 'deleted date is a valid date');
    });
  });

  describe('Update billing data', () => {
    beforeEach(async () => {
      await models.Establishment.query(knexInstance).insert({
        id: 101,
        name: 'Research 101',
        status: 'active',
        billing: {
          contactName: 'Dagny Aberkirder',
          contactNumber: '0181 811 8181'
        },
        updatedAt: '2018-01-01T12:00:00.000Z'
      });
    });

    it('can update the billing contact information', async () => {
      const opts = {
        id: 101,
        action: 'update-billing',
        data: {
          contactName: 'Bruce Banner'
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(101);

      assert.equal(establishment.billing.contactName, 'Bruce Banner');
      assert.ok(nowish(establishment.billing.updatedAt), 'timestamp should be updated to current time');
    });

    it('does not update the `updated_at` timestamp on the establishment', async () => {
      const opts = {
        id: 101,
        action: 'update-billing',
        data: {
          contactName: 'Bruce Banner'
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(101);

      assert.equal(establishment.updatedAt, '2018-01-01T12:00:00.000Z');
    });
  });

  describe('Update corporate status', () => {
    it('Replaces pelh when switching from non-profit to corporate', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]);

      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'corporate',
              nprc: PROFILE_ID_2
            }
          }, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.equal(establishment.corporateStatus, 'corporate');
      nowish(establishment.updatedAt, new Date().toISOString());

      const nprcRole = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'nprc' });
      assert.equal(nprcRole[0].profileId, PROFILE_ID_2);

      const pelhRole = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'pelh' });
      assert.equal(pelhRole.length, 0);
    });

    it('Replaces nprc and removes legal person details when switching from corporate to non-profit', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'corporate', legalName: 'John Responsible', legalEmail: 'john@responsible.com', legalPhone: '01234 123456' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]);
      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
          id: 8201,
          action: 'update',
          data: {
            corporateStatus: 'non-profit',
            pelh: PROFILE_ID_2
          }
          }, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);
      assert.equal(establishment.corporateStatus, 'non-profit');
      assert.equal(establishment.legalName, null);
      assert.equal(establishment.legalPhone, null);
      assert.equal(establishment.legalEmail, null);
      nowish(establishment.updatedAt, new Date().toISOString());

      const pelhRole = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'pelh' });
      assert.equal(pelhRole[0].profileId, PROFILE_ID_2);

      const nprcRole = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'nprc' });
      assert.equal(nprcRole.length, 0);
    });

    it('Replaces nprc and legal person details  when changed', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'corporate', legalName: 'John Responsible', legalEmail: 'john@responsible.com', legalPhone: '01234 123456' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]);

      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'corporate',
              nprc: PROFILE_ID_2,
              legalName: 'Dave Smith',
              legalEmail: 'dave@smith.com',
              legalPhone: '98765 987654'
            }
          }, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);

      assert.equal(establishment.corporateStatus, 'corporate');
      assert.equal(establishment.legalName, 'Dave Smith');
      assert.equal(establishment.legalEmail, 'dave@smith.com');
      assert.equal(establishment.legalPhone, '98765 987654');
      nowish(establishment.updatedAt, new Date().toISOString());

      const nprcRoles = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'nprc' });

      assert.equal(nprcRoles.length, 1);
      assert.equal(nprcRoles[0].profileId, PROFILE_ID_2);
    });

    it('Replaces pelh when changed', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]);

      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
          id: 8201,
          action: 'update',
          data: {
            corporateStatus: 'non-profit',
            pelh: PROFILE_ID_2
          }
        }, transaction);
      transaction.commit();

      const pelhRoles = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'pelh' });

      assert.equal(pelhRoles.length, 1);
      assert.equal(pelhRoles[0].profileId, PROFILE_ID_2);
    });

    it('Does not replace nprc when nprc same as existing', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'corporate' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1)
        ]);

      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
          id: 8201,
          action: 'update',
          data: {
            corporateStatus: 'corporate',
            nprc: PROFILE_ID_1
          }
        }, transaction);
      transaction.commit();

      const nprcRoles = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'nprc' });

      assert.equal(nprcRoles.length, 1);
      assert.equal(nprcRoles[0].profileId, PROFILE_ID_1);
    });

    it('Does not replace pelh when pelh same as existing', async () => {
      await models.Establishment.query(knexInstance).insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]);

      await models.Profile.query(knexInstance).insert([
          aProfile(PROFILE_ID_1)
        ]);

      await models.Role.query(knexInstance).insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]);

      transaction = await knexInstance.transaction();
      await this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'non-profit',
              pelh: PROFILE_ID_1
            }
        }, transaction);
      transaction.commit();

      const pelhRoles = await models.Role.query(knexInstance).where({ establishmentId: 8201, type: 'pelh' });

      assert.equal(pelhRoles.length, 1);
      assert.equal(pelhRoles[0].profileId, PROFILE_ID_1);
    });
  });

  describe('Update establishment details, Updating conditions', () => {
    beforeEach(async () => {
      await models.Establishment.query(knexInstance).insert([
        {
          id: 8201,
          name: 'University of Croydon',
          updatedAt: '2019-01-01T10:38:43.666Z'
        }
        ]);
    });

    it('adds the establishment condition when included', async () => {
      const opts = {
        action: 'update',
        id: 8201,
        data: {
          conditions: 'Test condition'
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);

      assert.ok(establishment);
      assert.ok(establishment.conditions === 'Test condition');
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('adds the condition reminder when included', async () => {
      const opts = {
        action: 'update',
        id: 8201,
        data: {
          conditions: 'Test condition',
          reminder: JSON.stringify(reminder)
        }
      };

      transaction = await knexInstance.transaction();
      const establishment = await this.establishment(opts, transaction);
      transaction.commit();
      assert.ok(establishment.conditions === 'Test condition');

      const reminderResponse = models.Reminder.query(knexInstance).findById(REMINDER_ID);
      assert.ok(reminderResponse);
      nowish(reminderResponse.updatedAt, new Date().toISOString());
    });

    it('removes the condition when it is not on the payload (deleted)', async () => {
      const opts = {
        action: 'update',
        id: 8201,
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const establishment = await models.Establishment.query(knexInstance).findById(8201);

      assert.ok(establishment.conditions === null);
      nowish(establishment.updatedAt, new Date().toISOString());
    });

    it('removes the reminder when it has the deleted flag', async () => {
      const opts = {
        action: 'update',
        id: 8201,
        data: {
          conditions: 'Test condition',
          reminder: JSON.stringify({
            id: REMINDER_ID,
            deadline: '2022-07-30',
            modelType: 'establishment',
            status: 'active',
            deleted: true
          })
        }
      };

      transaction = await knexInstance.transaction();
      await this.establishment(opts, transaction);
      transaction.commit();

      const reminder = await models.Reminder.query(knexInstance).findById(REMINDER_ID);
      assert.ok(reminder === undefined);
    });
  });

});
