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
      .then(() => this.models.Establishment.query().insert({
        id: 8201,
        name: 'Univerty of Croydon'
      }))
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
          procedures: ['A', 'B']
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
  });

});
