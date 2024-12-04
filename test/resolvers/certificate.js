const assert = require('assert');
const { certificate } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuidv4 } = require('uuid');

const id = uuidv4();
const profileId = uuidv4();

describe('Certificate resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.certificate = certificate({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    try {
      await models.Profile.query(knexInstance).insert({
        id: profileId,
        firstName: 'Sterling',
        lastName: 'Archer',
        email: 'sterline@archer.com'
      });

      await models.Certificate.query(knexInstance).insert({
        id,
        profileId,
        modules: [ 'PILB' ],
        species: ['mice']
      });

    } catch (error) {
      console.log(error);
    }
  });

  afterEach(async () => {
    await db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.certificate({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a certificate model', async () => {
      transaction = await knexInstance.transaction();
      const opts = {
        action: 'create',
        data: {
          profileId,
          modules: [ 'PILB' ],
          species: ['mice']
        }
      };
      await this.certificate(opts, transaction);
      await transaction.commit();

      const certificates = await models.Certificate.query(knexInstance).where({ profileId });
      const certificate = certificates[0];

      assert.ok(certificate);
      assert.deepEqual(certificate.modules, opts.data.modules);
      assert.deepEqual(certificate.species, opts.data.species);
    });
  });

  describe('Delete', async () => {
    it('soft deletes the model', async () => {
      const opts = {
        action: 'delete',
        id
      };

      transaction = await knexInstance.transaction();
      await this.certificate(opts, transaction);
      await transaction.commit();

      const certificate = await models.Certificate.query(knexInstance).findById(opts.id);
      assert.deepEqual(certificate, undefined);

      const deletedCertificate = await models.Certificate.queryWithDeleted(knexInstance).findById(opts.id);
      assert(deletedCertificate.deleted);
    });

  });
});
