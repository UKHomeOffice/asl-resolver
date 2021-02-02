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
    });

  });

});
