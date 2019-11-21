const assert = require('assert');
const moment = require('moment');
const { pil } = require('../../lib/resolvers');
const db = require('../helpers/db');

describe('PIL resolver', () => {
  before(() => {
    this.models = db.init();
    this.pil = pil({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert([
        {
          id: 8201,
          name: 'Univerty of Croydon'
        },
        {
          id: 8202,
          name: 'Marvell Pharma'
        }
      ]))
      .then(() => this.models.Profile.query().insertGraph({
        id: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
        userId: 'abc123',
        title: 'Dr',
        firstName: 'Linford',
        lastName: 'Christie',
        address: '1 Some Road',
        postcode: 'A1 1AA',
        email: 'test1@example.com',
        telephone: '01234567890'
      }));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
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
    it('can insert a pil model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          profileId: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
          licenceNumber: 'AB-123',
          procedures: ['A', 'B', 'D', 'F'],
          notesCatD: 'Some notes for CatD',
          notesCatF: 'Some notes for CatF'
        }
      };
      return Promise.resolve()
        .then(() => this.pil(opts))
        .then(() => this.models.PIL.query())
        .then(pils => pils[0])
        .then(pil => {
          assert.ok(pil);
          assert.deepEqual(pil.licenceNumber, opts.data.licenceNumber);
          assert.deepEqual(pil.site, opts.data.site);
          assert.deepEqual(pil.procedures, opts.data.procedures);
          assert.deepEqual(pil.notesCatD, opts.data.notesCatD);
          assert.deepEqual(pil.notesCatF, opts.data.notesCatF);
        });
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
    beforeEach(() => {
      return this.models.PIL.query().insert({
        id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
        profileId: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
        establishmentId: 8201,
        licenceNumber: 'AB-123',
        procedures: ['A', 'B']
      });
    });

    describe('Update', () => {
      it('can patch a pil', () => {
        const opts = {
          action: 'update',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1',
          data: {
            procedures: ['C']
          }
        };
        return Promise.resolve()
          .then(() => this.pil(opts))
          .then(() => this.models.PIL.query().findById(opts.id))
          .then(pil => {
            assert.deepEqual(pil.procedures, opts.data.procedures);
          });
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
      it('soft deletes the model', () => {
        const opts = {
          action: 'delete',
          id: '9fbe0218-995d-47d3-88e7-641fc046d7d1'
        };
        return Promise.resolve()
          .then(() => this.pil(opts))
          .then(() => this.models.PIL.query().findById(opts.id))
          .then(pil => {
            assert.deepEqual(pil, undefined);
          })
          .then(() => this.models.PIL.queryWithDeleted().findById(opts.id))
          .then(pil => {
            assert(pil.deleted);
            assert(moment(pil.deleted).isValid());
          });
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

    describe('Transfer', () => {
      it('can transfer a PIL to a new establishment', () => {
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
        return Promise.resolve()
          .then(() => this.pil(opts))
          .then(() => this.models.PIL.query().findById(opts.id))
          .then(pil => {
            assert.equal(pil.establishmentId, opts.data.establishment.to.id);
          })
          .then(() => this.models.PilTransfer.query().where({ pilId: opts.id }))
          .then(transfers => {
            assert(transfers.length === 1);
            assert(transfers[0].pilId === opts.id);
            assert(transfers[0].fromEstablishmentId === opts.data.establishment.from.id);
            assert(transfers[0].toEstablishmentId === opts.data.establishment.to.id);
          });
      });
    });
  });

  describe('Grant', () => {
    it('can grant a pil', () => {
      return this.models.PIL.query().insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
        establishmentId: 8201,
        procedures: ['A']
      }).then(() => {
        const opts = {
          action: 'grant',
          id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
          data: {}
        };
        return Promise.resolve()
          .then(() => this.pil(opts))
          .then(() => this.models.PIL.query().findById(opts.id))
          .then(pil => {
            assert.equal(pil.status, 'active', 'pil is active');
            assert(pil.licenceNumber, 'pil has a licence number');
            assert(pil.issueDate, 'pil has an issue date');
            assert(moment(pil.issueDate).isValid(), 'pil issue date is a valid date');
          });
      });
    });

    it('can re-grant a pil with a new issue date', () => {
      const originalIssueDate = moment('2019-10-01 12:00:00');

      return this.models.PIL.query().insert({
        id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
        profileId: 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9',
        establishmentId: 8201,
        status: 'revoked',
        issueDate: originalIssueDate.toISOString(),
        revocationDate: originalIssueDate.add(1, 'day').toISOString(),
        licenceNumber: 'XYZ-987',
        procedures: ['A']
      }).then(() => {
        const opts = {
          action: 'grant',
          id: '318301a9-c73d-42e2-a4c2-b070a9c5135f',
          data: {}
        };
        return Promise.resolve()
          .then(() => this.pil(opts))
          .then(() => this.models.PIL.query().findById(opts.id))
          .then(pil => {
            assert.equal(pil.status, 'active', 'pil is active');
            assert.equal(pil.licenceNumber, 'XYZ-987', 'pil licence number has not changed');
            assert(pil.issueDate, 'pil has an issue date');
            assert(originalIssueDate.isBefore(pil.issueDate), 'pil issue date has been updated to re-grant date');
          });
      });
    });
  });

});
