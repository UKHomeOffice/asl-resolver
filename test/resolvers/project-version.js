const assert = require('assert');
const { v4: uuid } = require('uuid');
const jsondiff = require('jsondiffpatch').create();

const { projectVersion } = require('../../lib/resolvers');
const db = require('../helpers/db');

const profileId = uuid();
const projectId = uuid();
const draftProjectId = uuid();
const versionId = uuid();
const draftVersionId = uuid();

describe('ProjectVersion resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.projectVersion = projectVersion({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert([
      {
        id: 8201,
        name: 'University of Croydon'
      },
      {
        id: 8202,
        name: 'Marvell Pharmaceutical'
      }
    ]);

    await models.Profile.query(knexInstance).insert({
        id: profileId,
        userId: 'abc123',
        title: 'Dr',
        firstName: 'Linford',
        lastName: 'Christie',
        address: '1 Some Road',
        postcode: 'A1 1AA',
        email: 'test1@example.com',
        telephone: '01234567890'
      });
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('patch', () => {

    beforeEach(async () => {
      await models.Project.query(knexInstance).insert([
        {
          id: projectId,
          status: 'active',
          title: 'Hypoxy and angiogenesis in cancer therapy',
          issueDate: new Date('2019-07-11').toISOString(),
          expiryDate: new Date('2022-07-11').toISOString(),
          licenceNumber: 'PP-627808',
          establishmentId: 8201,
          licenceHolderId: profileId
        },
        {
          id: draftProjectId,
          status: 'inactive',
          title: 'Inactive project',
          establishmentId: 8201,
          licenceHolderId: profileId
        }
      ]);

      await models.ProjectVersion.query(knexInstance).insert([
        {
          id: versionId,
          projectId,
          data: {},
          status: 'draft'
        },
        {
          id: draftVersionId,
          projectId: draftProjectId,
          data: {},
          status: 'draft'
        }
      ]);
    });

    it('can add a protocol to an empty project version', async () => {
      const protocolId = uuid();
      const opts = {
        action: 'patch',
        id: versionId,
        data: {
          patch: {
            protocols: {
              0: [
                {
                  id: protocolId,
                  speciesDetails: [],
                  steps: [],
                  title: 'TEST',
                  conditions: []
                }
              ],
              _t: 'a'
            },
            conditions: [
              []
            ]
          }
        }
      };

      transaction = await knexInstance.transaction();
      await this.projectVersion(opts, transaction);
      transaction.commit();

      const version = await models.ProjectVersion.query(knexInstance).findById(versionId);
      assert.equal(version.data.protocols.length, 1);
      assert.equal(version.data.protocols[0].title, 'TEST');
    });

    describe('retrospective assessment', () => {

      it('sets ra flag to true if training licence', async () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { 'training-licence': true })
          }
        };

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const version = await models.ProjectVersion.query(knexInstance).findById(draftVersionId);
        assert.equal(version.raCompulsory, true);
      });

      it('flags raCompulsory if severe protocol is added', async () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe' }] })
          }
        };

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const version = await models.ProjectVersion.query(knexInstance).findById(draftVersionId);
        assert.equal(version.raCompulsory, true);
      });

      it('does not flag raCompulsory if severe protocol is deleted', async () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe', deleted: true }] })
          }
        };

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const version = await models.ProjectVersion.query(knexInstance).findById(draftVersionId);
        assert.equal(version.raCompulsory, false);
      });

      it('does not remove raCompulsory flag if project is not a draft', async () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe', deleted: true }] })
          }
        };
        const patch = {
          data: {
            protocols: [{ severity: 'mild' }, { severity: 'severe' }]
          },
          raCompulsory: true
        };

        await models.ProjectVersion.query(knexInstance).patchAndFetchById(versionId, patch);

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const version = await models.ProjectVersion.query(knexInstance).findById(versionId);
        assert.equal(version.raCompulsory, true);
      });

      it('adds raCompulsory flag if project is not a draft', async () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe' }] })
          }
        };
        const patch = {
          data: {
            protocols: [{ severity: 'mild' }]
          },
          raCompulsory: false
        };

        await models.ProjectVersion.query(knexInstance).patchAndFetchById(versionId, patch);

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const version = await models.ProjectVersion.query(knexInstance).findById(versionId);
        assert.equal(version.raCompulsory, true);
      });

    });

    describe('Additional availability', () => {
      it('creates new ProjectEstablishment models for additional establishments', async () => {
        const establishments = [
          {
            'establishment-id': 8202
          }
        ];
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments, 'other-establishments': true })
          }
        };

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const projectEstablishments = await models.ProjectEstablishment.query(knexInstance).where({ projectId, establishmentId: 8202 });
        assert.equal(projectEstablishments.length, 1);
        assert.equal(projectEstablishments[0].status, 'draft');
      });

      it('removes draft ProjectEstablishment relations if removed from data', async () => {
        const establishments = [
          {
            'establishment-id': 8202
          }
        ];
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments, 'other-establishments': false })
          }
        };

        await models.ProjectEstablishment.query(knexInstance).insert({ establishmentId: 8202, projectId, status: 'draft' });

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const projectEstablishment = await models.ProjectEstablishment.query(knexInstance).where({ establishmentId: 8202, projectId }).first();
        assert.equal(projectEstablishment, null);
      });

      it('removes draft ProjectEstablishment relations no other establishments selected', async () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments: [], 'other-establishments': false })
          }
        };

        await models.ProjectEstablishment.query(knexInstance).insert({ establishmentId: 8202, projectId, status: 'draft' });

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const projectEstablishment = await models.ProjectEstablishment.query(knexInstance).where({ establishmentId: 8202, projectId }).first();
        assert.equal(projectEstablishment, null);
      });

      it('removes draft ProjectEstablishment relations if establishments are marked as deleted', async () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments: [{ 'establishment-id': 8202, deleted: true }], 'other-establishments': true })
          }
        };

        await models.ProjectEstablishment.query(knexInstance).insert({ establishmentId: 8202, projectId, status: 'draft' });

        transaction = await knexInstance.transaction();
        await this.projectVersion(opts, transaction);
        transaction.commit();

        const projectEstablishment = await models.ProjectEstablishment.query(knexInstance).where({ establishmentId: 8202, projectId }).first();
        assert.equal(projectEstablishment, null);
      });
    });

  });

  describe('updateConditions', () => {

    beforeEach(async () => {
      await models.Project.query(knexInstance).insert([
        {
          id: projectId,
          status: 'active',
          title: 'Hypoxy and angiogenesis in cancer therapy',
          issueDate: new Date('2019-07-11').toISOString(),
          expiryDate: new Date('2022-07-11').toISOString(),
          licenceNumber: 'PP-627808',
          establishmentId: 8201,
          licenceHolderId: profileId
        }
      ]);

      await models.ProjectVersion.query(knexInstance).insert([
        {
          id: versionId,
          projectId,
          data: {},
          status: 'granted'
        },
        {
          id: draftVersionId,
          projectId,
          data: {},
          status: 'draft'
        }
      ]);
    });

    it('can update the conditions on the project', async () => {
      const opts = {
        action: 'updateConditions',
        id: draftVersionId,
        data: {
          conditions: [
            {
              key: 'poles',
              path: 'poles.versions.0',
              type: 'condition',
              edited: 'Some POLE condition'
            }
          ]
        }
      };

      transaction = await knexInstance.transaction();
      await this.projectVersion(opts, transaction);
      transaction.commit();

      const version = await models.ProjectVersion.query(knexInstance).findById(draftVersionId);
      assert.deepEqual(version.data.conditions, opts.data.conditions, 'the conditions should match the updated conditions');
    });

    it('can update the condition reminders on the project', async () => {
      const opts = {
        action: 'updateConditions',
        id: draftVersionId,
        data: {
          conditions: [
            {
              key: 'poles',
              path: 'poles.versions.0',
              type: 'condition',
              edited: 'Some POLE condition',
              autoAdded: true,
              reminders: {
                poles: [
                  {
                    id: '8646d19e-9842-4f01-bd49-af987c8c6c0c',
                    deadline: '2023-01-01'
                  },
                  {
                    id: '99a5e7ae-d601-417c-a9ba-4487bfd47c79',
                    deadline: '2023-02-02'
                  }
                ],
                active: [ 'poles' ]
              }
            }
          ]
        }
      };

      transaction = await knexInstance.transaction();
      await this.projectVersion(opts, transaction);
      transaction.commit();

      const version = await models.ProjectVersion.query(knexInstance).findById(draftVersionId);
      const condition = version.data.conditions[0];
      assert.ok(!condition.reminders, 'the reminders should not be saved in the condition');

      const reminders = await models.Reminder.query(knexInstance).where({ modelType: 'project', modelId: projectId });
      assert.deepEqual(reminders.length, 2, 'there should be two reminders');
      assert.ok(reminders.every(r => r.status === 'pending'), 'all the reminders should be pending');
      assert.ok(reminders.every(r => r.conditionKey === 'poles'), 'all the reminders should be for the poles condition');
      assert.ok(reminders.find(r => r.deadline === '2023-01-01'), 'the first deadline should be present');
      assert.ok(reminders.find(r => r.deadline === '2023-02-02'), 'the second deadline should be present');
    });

    it('can remove the condition reminders on the project', async () => {
      const reminders = [
        {
          id: '8646d19e-9842-4f01-bd49-af987c8c6c0c',
          deadline: '2023-01-01',
          modelType: 'project',
          modelId: projectId,
          establishmentId: 8201,
          conditionKey: 'poles'
        },
        {
          id: '99a5e7ae-d601-417c-a9ba-4487bfd47c79',
          deadline: '2023-02-02',
          modelType: 'project',
          modelId: projectId,
          establishmentId: 8201,
          conditionKey: 'poles'
        }
      ];

      const opts = {
        action: 'updateConditions',
        id: draftVersionId,
        data: {
          conditions: [
            {
              key: 'poles',
              path: 'poles.versions.0',
              type: 'condition',
              edited: 'Some POLE condition',
              autoAdded: true,
              reminders: {
                poles: [
                  {
                    id: '8646d19e-9842-4f01-bd49-af987c8c6c0c',
                    deadline: '2023-01-01'
                  },
                  {
                    id: '99a5e7ae-d601-417c-a9ba-4487bfd47c79',
                    deadline: '2023-02-02'
                  }
                ],
                active: [ ] // <-- poles reminders checkbox was unticked
              }
            }
          ]
        }
      };

      await models.Reminder.query(knexInstance).insert(reminders);

      transaction = await knexInstance.transaction();
      await this.projectVersion(opts, transaction);
      transaction.commit();

      const responseReminders = await models.Reminder.query(knexInstance).where({ modelType: 'project', modelId: projectId });
      assert.deepEqual(responseReminders.length, 0, 'there should be no reminders');

      const remindersMarkedDeleted = await models.Reminder.queryWithDeleted(knexInstance).where({ modelType: 'project', modelId: projectId });
      assert.ok(remindersMarkedDeleted.every(r => r.deleted), 'all the reminders should be deleted');
    });

  });

});
