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

  describe('Suspend', () => {
    it('can suspend an establishment licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'active'
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'suspend',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query().findById(opts.id))
            .then(establishment => {
              assert.ok(establishment.suspendedDate, 'has a suspended date');
              assert.ok(moment(establishment.suspendedDate).isValid(), 'suspended date is a valid date');
            });
        });
    });
  });

  describe('Reinstate', () => {
    it('can reinstate an establishment licence', () => {
      return this.models.Establishment.query().insert({
        id: 101,
        name: 'Research 101',
        status: 'active',
        suspendedDate: moment().toISOString()
      })
        .then(() => {
          const opts = {
            id: 101,
            action: 'reinstate',
            data: {}
          };

          return Promise.resolve()
            .then(() => this.establishment(opts))
            .then(() => this.models.Establishment.query().findById(opts.id))
            .then(establishment => {
              assert.ok(!establishment.suspendedDate, 'no longer has a suspended date');
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
            .then(() => this.models.Reminder.queryWithDeleted().where({
              modelType: 'establishment',
              establishmentId: 101
            }))
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

  describe('Update corporate status', () => {
    it('Replaces pelh when switching from non-profit to corporate', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'corporate',
              nprc: PROFILE_ID_2
            }
          });
        })
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.equal(establishment.corporateStatus, 'corporate');
          nowish(establishment.updatedAt, new Date().toISOString());
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'nprc' }))
        .then(role => {
          assert.equal(role[0].profileId, PROFILE_ID_2);
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'pelh' }))
        .then((role) => {
          assert.equal(role.length, 0);
        });
    });

    it('Replaces nprc and removes legal person details when switching from corporate to non-profit', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'corporate', legalName: 'John Responsible', legalEmail: 'john@responsible.com', legalPhone: '01234 123456' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'non-profit',
              pelh: PROFILE_ID_2
            }
          });
        })
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.equal(establishment.corporateStatus, 'non-profit');
          assert.equal(establishment.legalName, null);
          assert.equal(establishment.legalPhone, null);
          assert.equal(establishment.legalEmail, null);
          nowish(establishment.updatedAt, new Date().toISOString());
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'pelh' }))
        .then(role => {
          assert.equal(role[0].profileId, PROFILE_ID_2);
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'nprc' }))
        .then((role) => {
          assert.equal(role.length, 0);
        });
    });

    it('Replaces nprc and legal person details  when changed', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'corporate', legalName: 'John Responsible', legalEmail: 'john@responsible.com', legalPhone: '01234 123456' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'corporate',
              nprc: PROFILE_ID_2,
              legalName: 'Dave Smith',
              legalEmail: 'dave@smith.com',
              legalPhone: '98765 987654'
            }
          });
        })
        .then(() => this.models.Establishment.query().findById(8201))
        .then(establishment => {
          assert.equal(establishment.corporateStatus, 'corporate');
          assert.equal(establishment.legalName, 'Dave Smith');
          assert.equal(establishment.legalEmail, 'dave@smith.com');
          assert.equal(establishment.legalPhone, '98765 987654');
          nowish(establishment.updatedAt, new Date().toISOString());
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'nprc' }))
        .then(roles => {
          assert.equal(roles.length, 1);
          assert.equal(roles[0].profileId, PROFILE_ID_2);
        });
    });

    it('Replaces pelh when changed', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1),
          aProfile(PROFILE_ID_2)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'non-profit',
              pelh: PROFILE_ID_2
            }
          });
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'pelh' }))
        .then(roles => {
          assert.equal(roles.length, 1);
          assert.equal(roles[0].profileId, PROFILE_ID_2);
        });
    });

    it('Does not replace nprc when nprc same as existing', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'corporate' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'nprc' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'corporate',
              nprc: PROFILE_ID_1
            }
          });
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'nprc' }))
        .then(roles => {
          assert.equal(roles.length, 1);
          assert.equal(roles[0].profileId, PROFILE_ID_1);
        });
    });

    it('Does not replace pelh when pelh same as existing', () => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          anEstablishment({ corporateStatus: 'non-profit' })
        ]))
        .then(() => this.models.Profile.query().insert([
          aProfile(PROFILE_ID_1)
        ]))
        .then(() => this.models.Role.query().insert([
          aRole({ profileId: PROFILE_ID_1, type: 'pelh' })
        ]))
        .then(() => {
          return this.establishment({
            id: 8201,
            action: 'update',
            data: {
              corporateStatus: 'non-profit',
              pelh: PROFILE_ID_1
            }
          });
        })
        .then(() => this.models.Role.query().where({ establishmentId: 8201, type: 'pelh' }))
        .then(roles => {
          assert.equal(roles.length, 1);
          assert.equal(roles[0].profileId, PROFILE_ID_1);
        });
    });
  });

  describe('Update establishment details', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          {
            id: 8201,
            name: 'University of Croydon',
            updatedAt: '2019-01-01T10:38:43.666Z'
          }
        ]));
    });

    describe('Updating conditions', () => {

      it('adds the establishment condition when included', () => {
        const opts = {
          action: 'update',
          id: 8201,
          data: {
            conditions: 'Test condition'
          }
        };
        return Promise.resolve()
          .then(() => this.establishment(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment);
            assert.ok(establishment.conditions === 'Test condition');
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });

      it('adds the condition reminder when included', () => {
        const opts = {
          action: 'update',
          id: 8201,
          data: {
            conditions: 'Test condition',
            reminder: JSON.stringify(reminder)
          }
        };
        return Promise.resolve()
          .then(() => this.establishment(opts))
          .then((establishment) => {
            assert.ok(establishment.conditions === 'Test condition');
          })
          .then(() => this.models.Reminder.query().findById(REMINDER_ID))
          .then(reminder => {
            assert.ok(reminder);
            nowish(reminder.updatedAt, new Date().toISOString());
          });
      });

      it('removes the condition when it is not on the payload (deleted)', () => {
        const opts = {
          action: 'update',
          id: 8201,
          data: {}
        };
        return Promise.resolve()
          .then(() => this.establishment(opts))
          .then(() => this.models.Establishment.query().findById(8201))
          .then(establishment => {
            assert.ok(establishment.conditions === null);
            nowish(establishment.updatedAt, new Date().toISOString());
          });
      });

      it('removes the reminder when it has the deleted flag', () => {
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
        return Promise.resolve()
          .then(() => this.establishment(opts))
          .then(() => this.models.Reminder.query().findById(REMINDER_ID))
          .then(reminder => {
            assert.ok(reminder === undefined);
          });
      });
    });

  });

});
