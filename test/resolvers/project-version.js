const assert = require('assert');
const uuid = require('uuid/v4');
const jsondiff = require('jsondiffpatch').create();

const { projectVersion } = require('../../lib/resolvers');
const db = require('../helpers/db');

const profileId = uuid();
const projectId = uuid();
const draftProjectId = uuid();
const versionId = uuid();
const draftVersionId = uuid();

describe('ProjectVersion resolver', () => {

  before(() => {
    this.models = db.init();
    this.projectVersion = projectVersion({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert([
        {
          id: 8201,
          name: 'University of Croydon'
        },
        {
          id: 8202,
          name: 'Marvell Pharmaceutical'
        }
      ]))
      .then(() => this.models.Profile.query().insert({
        id: profileId,
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

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  describe('patch', () => {

    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
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
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
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
        ]));
    });

    it('can add a protocol to an empty project version', () => {
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
      return Promise.resolve()
        .then(() => this.projectVersion(opts))
        .then(() => this.models.ProjectVersion.query().findById(versionId))
        .then(version => {
          assert.equal(version.data.protocols.length, 1);
          assert.equal(version.data.protocols[0].title, 'TEST');
        });
    });

    describe('retrospective assessment', () => {

      it('sets ra flag to true if training licence', () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { 'training-licence': true })
          }
        };
        return Promise.resolve()
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectVersion.query().findById(draftVersionId))
          .then(version => {
            assert.equal(version.raCompulsory, true);
          });
      });

      it('flags raCompulsory if severe protocol is added', () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe' }] })
          }
        };
        return Promise.resolve()
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectVersion.query().findById(draftVersionId))
          .then(version => {
            assert.equal(version.raCompulsory, true);
          });
      });

      it('does not flag raCompulsory if severe protocol is deleted', () => {
        const opts = {
          action: 'patch',
          id: draftVersionId,
          data: {
            patch: jsondiff.diff({}, { protocols: [{ severity: 'mild' }, { severity: 'severe', deleted: true }] })
          }
        };
        return Promise.resolve()
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectVersion.query().findById(draftVersionId))
          .then(version => {
            assert.equal(version.raCompulsory, false);
          });
      });

      it('does not remove raCompulsory flag if project is not a draft', () => {
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
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().patchAndFetchById(versionId, patch))
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectVersion.query().findById(versionId))
          .then(version => {
            assert.equal(version.raCompulsory, true);
          });
      });

      it('adds raCompulsory flag if project is not a draft', () => {
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
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().patchAndFetchById(versionId, patch))
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectVersion.query().findById(versionId))
          .then(version => {
            assert.equal(version.raCompulsory, true);
          });
      });

    });

    describe('Additional availability', () => {
      it('creates new ProjectEstablishment models for additional establishments', () => {
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
        return Promise.resolve()
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ projectId, establishmentId: 8202 }))
          .then(projectEstablishments => {
            assert.equal(projectEstablishments.length, 1);
            assert.equal(projectEstablishments[0].status, 'draft');
          });
      });

      it('removes draft ProjectEstablishment relations if removed from data', () => {
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
        return Promise.resolve()
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId, status: 'draft' }))
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment, null);
          });
      });

      it('removes draft ProjectEstablishment relations no other establishments selected', () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments: [], 'other-establishments': false })
          }
        };
        return Promise.resolve()
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId, status: 'draft' }))
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment, null);
          });
      });

      it('removes draft ProjectEstablishment relations if establishments are marked as deleted', () => {
        const opts = {
          action: 'patch',
          id: versionId,
          data: {
            patch: jsondiff.diff({}, { establishments: [{ 'establishment-id': 8202, deleted: true }], 'other-establishments': true })
          }
        };
        return Promise.resolve()
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId, status: 'draft' }))
          .then(() => this.projectVersion(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment, null);
          });
      });
    });

  });

  describe('updateConditions', () => {

    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
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
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
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
        ]));
    });

    it('can update the conditions on the project', () => {
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

      return Promise.resolve()
        .then(() => this.projectVersion(opts))
        .then(() => this.models.ProjectVersion.query().findById(draftVersionId))
        .then(version => {
          assert.deepEqual(version.data.conditions, opts.data.conditions, 'the conditions should match the updated conditions');
        });
    });

    it('can update the condition reminders on the project', () => {
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

      return Promise.resolve()
        .then(() => this.projectVersion(opts))
        .then(() => this.models.ProjectVersion.query().findById(draftVersionId))
        .then(version => {
          const condition = version.data.conditions[0];
          assert.ok(!condition.reminders, 'the reminders should not be saved in the condition');
        })
        .then(() => this.models.Reminder.query().where({ modelType: 'project', modelId: projectId }))
        .then(reminders => {
          assert.deepEqual(reminders.length, 2, 'there should be two reminders');
          assert.ok(reminders.every(r => r.status === 'pending'), 'all the reminders should be pending');
          assert.ok(reminders.every(r => r.conditionKey === 'poles'), 'all the reminders should be for the poles condition');
          assert.ok(reminders.find(r => r.deadline === '2023-01-01'), 'the first deadline should be present');
          assert.ok(reminders.find(r => r.deadline === '2023-02-02'), 'the second deadline should be present');
        });
    });

    it('can remove the condition reminders on the project', () => {
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

      return Promise.resolve()
        .then(() => this.models.Reminder.query().insert(reminders))
        .then(() => this.projectVersion(opts))
        .then(() => this.models.Reminder.query().where({ modelType: 'project', modelId: projectId }))
        .then(reminders => {
          assert.deepEqual(reminders.length, 0, 'there should be no reminders');
        })
        .then(() => this.models.Reminder.queryWithDeleted().where({ modelType: 'project', modelId: projectId }))
        .then(reminders => {
          assert.ok(reminders.every(r => r.deleted), 'all the reminders should be deleted');
        });
    });

  });

});
