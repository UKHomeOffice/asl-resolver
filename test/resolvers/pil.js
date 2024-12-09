const assert = require('assert');
const moment = require('moment');
const { pil } = require('../../lib/resolvers');
const db = require('../helpers/db');

const PILH = {
  id: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
  userId: 'abc123',
  title: 'Dr',
  firstName: 'Linford',
  lastName: 'Christie',
  address: '1 Some Road',
  postcode: 'A1 1AA',
  email: 'test1@example.com',
  telephone: '01234567890'
};

const HOLC = {
  id: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd0',
  userId: 'def456',
  title: 'Dr',
  firstName: 'Bruce',
  lastName: 'Banner',
  address: '1 Some Road',
  postcode: 'A1 1AA',
  email: 'holc@example.com',
  telephone: '01234567890',
  pilLicenceNumber: 'I1234567890'
};

const LICENSING = {
  id: 'a942ffc7-e7ca-4d76-a001-0b5048a057d2',
  firstName: 'Li Sen',
  lastName: 'Xing',
  email: 'lisenxing@example.com',
  asru: [{ id: 8201 }],
  asruUser: true,
  asruLicensing: true
};

const INSPECTOR = {
  id: 'a942ffc7-e7ca-4d76-a001-0b5048a057d1',
  firstName: 'Inspector',
  lastName: 'Morse',
  email: 'asru-inspector@example.com',
  asruUser: true,
  asruInspector: true
};

const CONDITIONS_PIL = {
  id: '92bec570-ca04-47b2-bafc-43e95fb7f564',
  profileId: PILH.id,
  establishmentId: 8201,
  status: 'active',
  licenceNumber: 'XYZ-987',
  procedures: ['A']
};

function isThenish(date, expected) {
  return moment(date).isBetween(moment(expected).subtract(5, 'seconds'), moment(expected).add(5, 'seconds'));
}

describe('PIL resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.pil = pil({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert([
      {
        id: 8201,
        name: 'Univerty of Croydon'
      },
      {
        id: 8202,
        name: 'Marvell Pharma'
      }
    ]);

    await models.Profile.query(knexInstance).insertGraph(
      [PILH, HOLC, LICENSING],
      { relate: true }
    );
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.pil({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a pil model', async () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: PILH.id,
          licenceNumber: 'AB-123',
          procedures: ['A', 'B', 'D', 'F'],
          notesCatD: 'Some notes for CatD',
          notesCatF: 'Some notes for CatF'
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pils = await models.PIL.query(knexInstance);
      const pil = pils[0];

      assert.ok(pil);
      assert.deepEqual(pil.licenceNumber, opts.data.licenceNumber);
      assert.deepEqual(pil.site, opts.data.site);
      assert.deepEqual(pil.procedures, opts.data.procedures);
      assert.deepEqual(pil.notesCatD, opts.data.notesCatD);
      assert.deepEqual(pil.notesCatF, opts.data.notesCatF);
    });

    it('rejects an invalid pil model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          licenceNumber: 'ABC-123'
          // no profile specified
        }
      };
      return assert.rejects(() => {
        return this.pil(opts);
      }, { name: 'ValidationError' });
    });
  });

  describe('with existing', () => {
    beforeEach(async () => {
      return models.PIL.query(knexInstance).insert({
        id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
        profileId: PILH.id,
        establishmentId: 8201,
        licenceNumber: 'AB-123',
        procedures: ['A', 'B']
      });
    });

    describe('Update', () => {
      it('can patch a pil', async () => {
        const opts = {
          action: 'update',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
          data: {
            procedures: ['C']
          }
        };

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pil = await models.PIL.query(knexInstance).findById(opts.id);
        assert.deepEqual(pil.procedures, opts.data.procedures);
      });

      it('rejects updates with an error if id omitted', () => {
        const opts = {
          action: 'update',
          data: {
            procedures: ['C']
          }
        };
        return assert.rejects(() => {
          return this.pil(opts);
        }, {
          name: 'Error',
          message: /id is required on update/
        });
      });
    });

    describe('Delete', () => {
      it('soft deletes the model', async () => {
        const opts = {
          action: 'delete',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1'
        };

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pilSoftDelete = await models.PIL.query(knexInstance).findById(opts.id);
        assert.deepEqual(pilSoftDelete, undefined);

        const pilMarkedAsDeleted = await models.PIL.queryWithDeleted(knexInstance).findById(opts.id);

        assert(pilMarkedAsDeleted.deleted);
        assert(moment(pilMarkedAsDeleted.deleted).isValid());
      });

      it('rejects deletes an error if id omitted', () => {
        const opts = {
          action: 'delete'
        };
        return assert.rejects(() => {
          return this.pil(opts);
        }, {
          name: 'Error',
          message: /id is required on delete/
        });
      });
    });

    describe('review', () => {
      it('sets the review date to 5 years from now', async () => {
        const opts = {
          action: 'review',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1'
        };
        const expected = moment().add(5, 'years');

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pil = await models.PIL.query(knexInstance).findById(opts.id);
        assert.ok(isThenish(pil.reviewDate, expected));
      });
    });

    describe('Transfer', () => {
      it('can transfer a PIL to a new establishment', async () => {
        const opts = {
          action: 'transfer',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
          data: {
            establishment: {
              from: { id: 8201, name: 'University of Croydon' },
              to: { id: 8202, name: 'Marvell Pharma' }
            }
          }
        };

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pil = await models.PIL.query(knexInstance).findById(opts.id);
        assert.equal(pil.establishmentId, opts.data.establishment.to.id);

        const transfers = await models.PilTransfer.query(knexInstance).where({ pilId: opts.id });
        assert(transfers.length === 1);
        assert(transfers[0].pilId === opts.id);
        assert(transfers[0].fromEstablishmentId === opts.data.establishment.from.id);
        assert(transfers[0].toEstablishmentId === opts.data.establishment.to.id);
      });
    });

    describe('Suspend', () => {
      it('can suspend a PIL', async () => {
        const opts = {
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
          action: 'suspend',
          changedBy: INSPECTOR.id,
          data: {}
        };

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pil = await models.PIL.query(knexInstance).findById(opts.id);
        assert.ok(pil.suspendedDate, 'it has as a suspended date');
        assert(moment(pil.suspendedDate).isValid(), 'pil suspended date is a valid date');
      });
    });

    describe('Reinstate', () => {
      it('can reinstate a suspended PIL', async () => {
        const opts = {
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
          action: 'reinstate',
          changedBy: INSPECTOR.id,
          data: {}
        };

        await models.PIL.query(knexInstance).patchAndFetchById(opts.id, { suspendedDate: moment().toISOString() });

        transaction = await knexInstance.transaction();
        await this.pil(opts, transaction);
        transaction.commit();

        const pil = await models.PIL.query(knexInstance).findById(opts.id);
        assert.ok(!pil.suspendedDate, 'it no longer has a suspended date');
      });
    });
  });

  describe('Grant', () => {
    const expectedReviewDate = moment().add(5, 'years');

    it('can grant a pil', async () => {
      await models.PIL.query(knexInstance).insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: PILH.id,
        establishmentId: 8201,
        procedures: ['A']
      });

      const opts = {
        action: 'grant',
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        changedBy: PILH.id,
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pil = await models.PIL.query(knexInstance).findById(opts.id).withGraphFetched('profile');
      assert.equal(pil.status, 'active', 'pil is active');
      assert(pil.profile.pilLicenceNumber, 'profile has a PIL licence number');
      assert(pil.issueDate, 'pil has an issue date');
      assert(moment(pil.issueDate).isValid(), 'pil issue date is a valid date');
      assert(pil.reviewDate, 'pil has a review date');
      assert(moment(pil.reviewDate).isSame(expectedReviewDate, 'day'), 'pil review date is 5 years from issue date');
    });

    it('can re-grant a revoked pil with a new issue date', async () => {
      const originalIssueDate = moment('2019-10-01 12:00:00');
      const originalRevocationDate = moment('2019-10-02 12:00:00');

      await models.PIL.query(knexInstance).insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: PILH.id,
        establishmentId: 8201,
        status: 'revoked',
        issueDate: originalIssueDate.toISOString(),
        revocationDate: originalRevocationDate.toISOString(),
        procedures: ['A'],
        species: ['mice']
      });

      await models.Profile.query(knexInstance).patchAndFetchById(PILH.id, { pilLicenceNumber: 'XYZ-987' });

      const opts = {
        action: 'grant',
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        changedBy: PILH.id,
        data: {
          procedures: ['A', 'B'],
          species: ['mice', 'rats']
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const singlePIL = await models.PIL.query(knexInstance).findById(opts.id).withGraphFetched('profile');
      assert.equal(singlePIL.profile.pilLicenceNumber, 'XYZ-987');
      assert.equal(singlePIL.status, 'revoked', 'old pil should still be revoked');
      assert(moment(singlePIL.issueDate).isSame(originalIssueDate, 'day'), 'old pil issue date should not have been changed');

      const pils = await models.PIL.query(knexInstance).where({ profileId: PILH.id });
      assert.equal(pils.length, 2, 'A new PIL record should be created with the same licence number');

      const pil = pils.find(p => p.status === 'active');
      assert.equal(pil.establishmentId, 8201);
      assert.deepEqual(pil.species, ['mice', 'rats']);
      assert.deepEqual(pil.procedures, ['A', 'B']);
      assert(moment(pil.issueDate).isSame(moment(), 'day'), 'new pil issue date should be todays date');
      assert(moment(pil.reviewDate).isSame(moment().add(5, 'years'), 'day'), 'new pil review date should be 5 years time');
      assert.equal(pil.revocationDate, null);
    });

    it('amendments do not reset the issue date but update the review date', async () => {
      const originalIssueDate = moment('2019-10-01 12:00:00');
      const originalReviewDate = moment('2024-10-01 12:00:00');
      const expectedReviewDate = moment().add(5, 'years');

      await models.PIL.query(knexInstance).insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: PILH.id,
        establishmentId: 8201,
        status: 'active',
        issueDate: originalIssueDate.toISOString(),
        reviewDate: originalReviewDate.toISOString(),
        licenceNumber: 'XYZ-987',
        procedures: ['A']
      });

      const opts = {
        action: 'grant',
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        changedBy: PILH.id,
        data: {
          procedures: ['A', 'B']
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pil = await models.PIL.query(knexInstance).findById(opts.id);
      assert.equal(pil.status, 'active', 'pil is active');
      assert.equal(pil.licenceNumber, 'XYZ-987', 'pil licence number should not be changed');
      assert(pil.issueDate, 'pil has an issue date');
      assert(moment(pil.issueDate).isSame(originalIssueDate, 'day'), 'pil issue date should not be updated');
      assert(pil.reviewDate, 'pil has a review date');
      assert(moment(pil.reviewDate).isSame(expectedReviewDate, 'day'), 'pil review date should be 5 years from current date');
    });

    it('amendments by ASRU do not reset the review date', async () => {
      const originalIssueDate = moment('2019-10-01 12:00:00');
      const originalReviewDate = moment('2024-10-01 12:00:00');

      await models.PIL.query(knexInstance).insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: PILH.id,
        establishmentId: 8201,
        status: 'active',
        issueDate: originalIssueDate.toISOString(),
        reviewDate: originalReviewDate.toISOString(),
        licenceNumber: 'XYZ-987',
        procedures: ['A']
      });

      const opts = {
        action: 'grant',
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        changedBy: LICENSING.id,
        data: {
          procedures: ['A', 'B']
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pil = await models.PIL.query(knexInstance).findById(opts.id);
      assert.equal(pil.status, 'active', 'pil is active');
      assert.equal(pil.licenceNumber, 'XYZ-987', 'pil licence number should not be changed');
      assert(pil.issueDate, 'pil has an issue date');
      assert(moment(pil.issueDate).isSame(originalIssueDate, 'day'), 'pil issue date should not be updated');
      assert(pil.reviewDate, 'pil has a review date');
      assert.equal(pil.reviewDate, originalReviewDate.toISOString(), 'pil review date should be 5 years from original issue date');
    });

    it('creates a licence number if the user does not have one', async () => {
      await models.PIL.query(knexInstance).insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: PILH.id,
        establishmentId: 8201,
        procedures: ['A']
      });

      const opts = {
        action: 'grant',
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        changedBy: HOLC.id,
        data: {}
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pil = await models.PIL.query(knexInstance).findById(opts.id).withGraphFetched('profile');
      assert(pil.profile.pilLicenceNumber, 'profile has a PIL licence number');
    });
  });

  describe('Update conditions', () => {
    beforeEach(async () => {
      return models.PIL.query(knexInstance).insert(CONDITIONS_PIL);
    });

    it('can update the existing conditions', async () => {
      const opts = {
        action: 'update-conditions',
        id: CONDITIONS_PIL.id,
        data: {
          conditions: 'Some new conditions'
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const pil = await models.PIL.query(knexInstance).findById(opts.id);
      assert.deepEqual(pil.conditions, 'Some new conditions', 'the conditions should be updated');
    });

    it('can save a new condition reminder', async () => {
      const opts = {
        action: 'update-conditions',
        id: CONDITIONS_PIL.id,
        data: {
          conditions: 'Some new conditions',
          reminder: {
            deadline: '2022-07-01'
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.pil(opts, transaction);
      transaction.commit();

      const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'pil', modelId: opts.id });
      assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
      assert.deepEqual(reminders[0].deadline, '2022-07-01', 'the deadline should be correct');
      assert.deepEqual(reminders[0].status, 'active', 'the status should be active');
      assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
    });

    it('can update an existing condition reminder', async () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'pil',
        modelId: CONDITIONS_PIL.id,
        establishmentId: CONDITIONS_PIL.establishmentId,
        status: 'active'
      };

      const responseReminder = await models.Reminder.query(knexInstance).insert(reminder).returning('id');

      const opts = {
        id: CONDITIONS_PIL.id,
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
      await this.pil(opts, transaction);
      transaction.commit();

      const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'pil', modelId: opts.id });
      assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
      assert.deepEqual(reminders[0].deadline, '2022-11-22', 'the deadline should be updated');
      assert.deepEqual(reminders[0].status, 'active', 'the status should still be active');
      assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
    });

    it('can delete an existing condition reminder', async () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'pil',
        modelId: CONDITIONS_PIL.id,
        establishmentId: CONDITIONS_PIL.establishmentId,
        status: 'active'
      };

      const responseReminder = await models.Reminder.query(knexInstance).insert(reminder).returning('id');

      const opts = {
        id: CONDITIONS_PIL.id,
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
      await this.pil(opts, transaction);
      transaction.commit();

      const remindersUpdatedConditions = await models.Reminder.query(knexInstance).where({ modelType: 'pil', modelId: opts.id });
      assert.deepEqual(remindersUpdatedConditions.length, 0, 'there should be no reminders returned in the standard query');

      const reminders = await models.Reminder.queryWithDeleted(knexInstance).where({ modelType: 'pil', modelId: opts.id });
      assert.deepEqual(reminders.length, 1, 'there should be a single deleted reminder');
      assert.ok(reminders[0].deleted, 'the deleted column should be set');
      assert(moment(reminders[0].deleted).isValid(), 'deleted date is a valid date');
    });
  });

});
