const assert = require('assert');
const moment = require('moment');
const { establishment } = require('../../lib/resolvers');
const db = require('../helpers/db');

const nowish = (a, b, n = 3) => {
  const diff = moment(a).diff(b, 'seconds');
  return Math.abs(diff) < n;
};

describe('Establishment resolver', () => {
  before(() => {
    this.models = db.init();
    this.establishment = establishment({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
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
    it('can insert an establishment', () => {
      const opts = {
        action: 'create',
        data: {
          name: 'New establishment'
        }
      };
      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Establishment.query())
        .then(establishments => establishments[0])
        .then(establishment => {
          assert.ok(establishment);
          assert.deepEqual(establishment.name, opts.data.name);
          assert.deepEqual(establishment.status, 'inactive');
        });
    });
  });

  describe('Grant', () => {
    it('can grant a licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'inactive'
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'grant',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query())
            .then(establishments => establishments[0])
            .then(establishment => {
              assert.ok(establishment.licenceNumber, 'has a generated licence number');
              assert.deepEqual(establishment.status, 'active', 'status has been changed to active');
              assert(establishment.issueDate, 'has an issue date');
              assert(moment(establishment.issueDate).isValid(), 'issue date is a valid date');
            });
        });
    });
  });

  describe('Revoke', () => {
    it('can revoke an establishment licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'active'
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'revoke',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query())
            .then(establishments => establishments[0])
            .then(establishment => {
              assert.deepEqual(establishment.status, 'revoked', 'status has been changed to revoked');
              assert(establishment.revocationDate, 'has a revocation date');
              assert(moment(establishment.revocationDate).isValid(), 'revocation date is a valid date');
            });
        });
    });

  });

  describe('Update conditions', () => {
    beforeEach(() => {
      return this.models.Establishment.query().insert({ id: 101, name: 'Research 101', status: 'active' });
    });

    it('can update the existing conditions', () => {
      const opts = {
        id: 101,
        action: 'update-conditions',
        data: {
          conditions: 'Some new conditions'
        }
      };

      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Establishment.query().findById(101))
        .then(establishment => {
          assert.deepEqual(establishment.conditions, 'Some new conditions', 'the conditions should be updated');
        });
    });

    it('can save a new condition reminder', () => {
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

      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Reminder.query().where({ modelType: 'establishment', establishmentId: 101 }))
        .then(reminders => {
          assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
          assert.deepEqual(reminders[0].deadline, '2022-07-03', 'the deadline should be correct');
          assert.deepEqual(reminders[0].status, 'active', 'the status should be active');
          assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
        });
    });

    it('can update an existing condition reminder', () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'establishment',
        establishmentId: 101,
        status: 'active'
      };

      return this.models.Reminder.query().insert(reminder).returning('id')
        .then(reminder => {
          const opts = {
            id: 101,
            action: 'update-conditions',
            data: {
              conditions: 'Some new conditions',
              reminder: {
                id: reminder.id,
                deadline: '2022-11-22'
              }
            }
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Reminder.query().where({ modelType: 'establishment', establishmentId: 101 }))
            .then(reminders => {
              assert.deepEqual(reminders.length, 1, 'there should be a single reminder');
              assert.deepEqual(reminders[0].deadline, '2022-11-22', 'the deadline should be updated');
              assert.deepEqual(reminders[0].status, 'active', 'the status should still be active');
              assert.deepEqual(reminders[0].deleted, null, 'the deleted column should be null');
            });
        });
    });

    it('can delete an existing condition reminder', () => {
      const reminder = {
        deadline: '2022-07-03',
        modelType: 'establishment',
        establishmentId: 101,
        status: 'active'
      };

      return this.models.Reminder.query().insert(reminder).returning('id')
        .then(reminder => {
          const opts = {
            id: 101,
            action: 'update-conditions',
            data: {
              conditions: 'Some new conditions',
              reminder: {
                id: reminder.id,
                deleted: true
              }
            }
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Reminder.query().where({ modelType: 'establishment', establishmentId: 101 }))
            .then(reminders => {
              assert.deepEqual(reminders.length, 0, 'there should be no reminders returned in the standard query');
            })
            .then(() => this.models.Reminder.queryWithDeleted().where({ modelType: 'establishment', establishmentId: 101 }))
            .then(reminders => {
              assert.deepEqual(reminders.length, 1, 'there should be a single deleted reminder');
              assert.ok(reminders[0].deleted, 'the deleted column should be set');
              assert(moment(reminders[0].deleted).isValid(), 'deleted date is a valid date');
            });
        });
    });
  });

  describe('Update billing data', () => {
    beforeEach(() => {
      return this.models.Establishment.query().insert({
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

    it('can update the billing contact information', () => {
      const opts = {
        id: 101,
        action: 'update-billing',
        data: {
          contactName: 'Bruce Banner'
        }
      };

      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Establishment.query().findById(101))
        .then(establishment => {
          assert.equal(establishment.billing.contactName, 'Bruce Banner');
          assert.ok(nowish(establishment.billing.updatedAt), 'timestamp should be updated to current time');
        });
    });

    it('does not update the `updated_at` timestamp on the establishment', () => {
      const opts = {
        id: 101,
        action: 'update-billing',
        data: {
          contactName: 'Bruce Banner'
        }
      };

      return Promise.resolve()
        .then(() => this.establishment(opts))
        .then(() => this.models.Establishment.query().findById(101))
        .then(establishment => {
          assert.equal(establishment.updatedAt, '2018-01-01T12:00:00.000Z');
        });
    });
  });

});
