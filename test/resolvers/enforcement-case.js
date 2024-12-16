const assert = require('assert');
const { enforcementCase } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

const establishment = {
  id: 8201,
  name: 'University of Croydon',
  status: 'active'
};

const profileId = uuid();
const pilId = uuid();
const projectId = uuid();

const profile = {
  id: profileId,
  firstName: 'Rule',
  lastName: 'Breaker',
  email: 'rulebreaker@example.com',
  pilLicenceNumber: 'ABC-123',
  pil: {
    id: pilId,
    status: 'active',
    establishmentId: 8201,
    issueDate: new Date().toISOString(),
    procedures: ['A', 'B']
  },
  projects: [
    {
      id: projectId,
      establishmentId: 8201,
      status: 'active',
      title: 'Test project'
    }
  ]
};

describe('Enforcement case resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.enforcementCase = enforcementCase({ models });
  });

  beforeEach(async () => {
    await db.clean(models);
    await models.Establishment.query(knexInstance).insert(establishment);
    await models.Profile.query(knexInstance).insertGraph(profile);
  });

  afterEach(async () => {
    await db.clean(models);
  });

  after(async () => {
    await db.clean(models);
    await knexInstance.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.enforcementCase({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {

    it('can create a new enforcement case record', async () => {
      const opts = {
        action: 'create',
        data: {
          caseNumber: '1234'
        }
      };

      let enforcementCases = await models.EnforcementCase.query(knexInstance);
      assert.strictEqual(enforcementCases.length, 0);

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      enforcementCases = await models.EnforcementCase.query(knexInstance);
      assert.ok(enforcementCases.length === 1);
      assert.strictEqual(enforcementCases[0].caseNumber, opts.data.caseNumber);
    });

  });

  describe('Update flags', () => {

    it('the subject will automatically be inserted if it does not exist', async () => {
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insert({ caseNumber: '1234' });
      const subjectId = uuid();

      let subject = await models.EnforcementSubject.query(knexInstance).findById(subjectId);
      assert.ok(!subject, 'the subject should not exist');

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              }
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      subject = await models.EnforcementSubject.query(knexInstance).findById(subjectId);
      assert.ok(subject, 'the subject exists');
    });

    it('inserts all the flags if there are no existing flags for the subject', async () => {
      const subjectId = uuid();
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insertGraph({
        caseNumber: '1234',
        subjects: [
          {
            id: subjectId,
            establishmentId: 8201,
            profileId,
            flags: []
          }
        ]
      });
      let flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 0);

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                subjectId,
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              },
              {
                subjectId,
                modelType: 'pil',
                modelId: pilId,
                status: 'open'
              },
              {
                subjectId,
                modelType: 'project',
                modelId: projectId,
                status: 'open'
              }
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 3);

      const profileFlag = flags.find(f => f.modelId === profileId);
      assert.strictEqual(profileFlag.modelType, 'profile');
      assert.strictEqual(profileFlag.status, 'open');

      const pilFlag = flags.find(f => f.modelId === pilId);
      assert.strictEqual(pilFlag.modelType, 'pil');
      assert.strictEqual(pilFlag.status, 'open');

      const projectFlag = flags.find(f => f.modelId === projectId);
      assert.strictEqual(projectFlag.modelType, 'project');
      assert.strictEqual(projectFlag.status, 'open');
    });

    it('will update the flag status for existing flags', async () => {
      const subjectId = uuid();
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insertGraph({
        caseNumber: '1234',
        subjects: [
          {
            id: subjectId,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              },
              {
                modelType: 'pil',
                modelId: pilId,
                status: 'open'
              },
              {
                modelType: 'establishment',
                establishmentId: 8201,
                status: 'open'
              }
            ]
          }
        ]
      });
      let flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId, status: 'open' });
      assert.strictEqual(flags.length, 3, 'the flags should be open');

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                subjectId,
                modelType: 'profile',
                modelId: profileId,
                status: 'closed'
              },
              {
                subjectId,
                modelType: 'pil',
                modelId: pilId,
                status: 'closed'
              },
              {
                subjectId,
                modelType: 'establishment',
                establishmentId: 8201,
                status: 'closed'
              }
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      flags = (await models.EnforcementFlag.query(knexInstance).where({ subjectId })).filter(f => f.status === 'closed');
      assert.strictEqual(flags.length, 3, 'the flags should be closed');
    });

    it('will soft-delete existing flags that are not present in the request', async () => {
      const subjectId = uuid();
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insertGraph({
        caseNumber: '1234',
        subjects: [
          {
            id: subjectId,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              },
              {
                modelType: 'pil',
                modelId: pilId,
                status: 'open'
              }
            ]
          }
        ]
      });
      let flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 2, 'there should be 2 flags');

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                subjectId,
                modelType: 'profile',
                modelId: profileId,
                status: 'closed'
              }
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 1, 'there should be 1 flag');
      assert.ok(!flags.find(f => f.modelId === pilId), 'the pil flag should be deleted');

      const softDeletedFlag = await models.EnforcementFlag.queryWithDeleted(knexInstance).where({ modelId: pilId }).first();
      assert.ok(softDeletedFlag.deleted, 'the pil flag has a deleted timestamp');
    });

    it('can add, update and remove flags in the same request', async () => {
      const subjectId = uuid();
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insertGraph({
        caseNumber: '1234',
        subjects: [
          {
            id: subjectId,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              },
              {
                modelType: 'pil',
                modelId: pilId,
                status: 'open'
              }
            ]
          }
        ]
      });

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                subjectId,
                modelType: 'profile',
                modelId: profileId,
                status: 'closed'
              },
              {
                subjectId,
                modelType: 'project',
                modelId: projectId,
                status: 'closed'
              }
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      const flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 2, 'there should be 2 flags');
      assert.ok(!flags.find(f => f.modelId === pilId), 'the pil flag should be deleted');
      assert.ok(flags.find(f => f.modelId === projectId), 'the project flag should be added');
      assert.ok(flags.every(f => f.status === 'closed'), 'all flags should be closed');
    });

    it('will delete the subject if all flags are removed', async () => {
      const subjectId = uuid();
      const enforcementCase = await models.EnforcementCase.query(knexInstance).insertGraph({
        caseNumber: '1234',
        subjects: [
          {
            id: subjectId,
            establishmentId: 8201,
            profileId,
            flags: [
              {
                modelType: 'profile',
                modelId: profileId,
                status: 'open'
              }
            ]
          }
        ]
      });

      const opts = {
        action: 'update-subject',
        id: enforcementCase.id,
        data: {
          subject: {
            id: subjectId,
            caseId: enforcementCase.id,
            establishmentId: 8201,
            profileId
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.enforcementCase(opts, transaction);
      await transaction.commit();

      const flags = await models.EnforcementFlag.query(knexInstance).where({ subjectId });
      assert.strictEqual(flags.length, 0, 'there should be no flags');

      const subject = await models.EnforcementSubject.query(knexInstance).findById(subjectId);
      assert.ok(!subject, 'the subject should be deleted');
    });
  });

});
