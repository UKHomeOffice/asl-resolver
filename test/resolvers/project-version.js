const assert = require('assert');
const uuid = require('uuid/v4');
const jsondiff = require('jsondiffpatch').create();

const { projectVersion } = require('../../lib/resolvers');
const db = require('../helpers/db');

const profileId = uuid();
const projectId = uuid();
const draftProject = uuid();
const legacyProject = uuid();
const legacyDraft = uuid();
const versionId = uuid();

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

  describe('submit', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            title: 'Active project',
            issueDate: new Date('2019-07-11').toISOString(),
            expiryDate: new Date('2022-07-11').toISOString(),
            licenceNumber: 'PP-627100',
            establishmentId: 8201,
            licenceHolderId: profileId,
            schemaVersion: 1
          },
          {
            id: draftProject,
            status: 'inactive',
            title: 'Draft project',
            establishmentId: 8201,
            licenceHolderId: profileId,
            schemaVersion: 1
          },
          {
            id: legacyProject,
            status: 'active',
            title: 'Legacy project',
            issueDate: new Date('2019-07-11').toISOString(),
            expiryDate: new Date('2022-07-11').toISOString(),
            licenceNumber: 'PP-627101',
            establishmentId: 8201,
            licenceHolderId: profileId,
            schemaVersion: 0
          },
          {
            id: legacyDraft,
            status: 'inactive',
            title: 'Legacy draft',
            establishmentId: 8201,
            licenceHolderId: profileId,
            schemaVersion: 0
          }
        ]));
    });

    it('sets the project species for a draft project', () => {
      const version = {
        id: uuid(),
        projectId: draftProject,
        data: {
          species: ['mice', 'rats']
        }
      };

      const opts = {
        action: 'submit',
        id: version.id
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.projectVersion(opts))
        .then(() => this.models.Project.query().findById(draftProject))
        .then(project => {
          const expected = [
            'Mice',
            'Rats'
          ];
          assert.deepEqual(project.species, expected);
        });
    });

    it('doesn\'t set the project species for an active project', () => {
      const version = {
        id: uuid(),
        projectId,
        data: {
          species: ['mice', 'rats']
        }
      };

      const opts = {
        action: 'submit',
        id: version.id
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.projectVersion(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.deepEqual(project.species, null);
        });
    });

    it('sets the project species for a legacy draft project', () => {
      const version = {
        id: uuid(),
        projectId: legacyDraft,
        data: {
          protocols: [
            {
              species: [
                {
                  speciesId: '20'
                },
                {
                  speciesId: '25'
                }
              ]
            }
          ]
        }
      };

      const opts = {
        action: 'submit',
        id: version.id
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.projectVersion(opts))
        .then(() => this.models.Project.query().findById(legacyDraft))
        .then(project => {
          const expected = [
            'Mice',
            'Rats'
          ];
          assert.deepEqual(project.species, expected);
        });
    });

    it('doesn\'t set the project species for an active legacy project', () => {
      const version = {
        id: uuid(),
        projectId: legacyProject,
        data: {
          protocols: [
            {
              species: [
                {
                  speciesId: '20'
                },
                {
                  speciesId: '25'
                }
              ]
            }
          ]
        }
      };

      const opts = {
        action: 'submit',
        id: version.id
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.projectVersion(opts))
        .then(() => this.models.Project.query().findById(legacyProject))
        .then(project => {
          assert.deepEqual(project.species, null);
        });
    });
  });

  describe('patch', () => {

    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert({
          id: projectId,
          status: 'active',
          title: 'Hypoxy and angiogenesis in cancer therapy',
          issueDate: new Date('2019-07-11').toISOString(),
          expiryDate: new Date('2022-07-11').toISOString(),
          licenceNumber: 'PP-627808',
          establishmentId: 8201,
          licenceHolderId: profileId
        }))
        .then(() => this.models.ProjectVersion.query().insert({
          id: versionId,
          projectId,
          data: {},
          status: 'draft'
        }));
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

    it('sets ra flag to true if training licence', () => {
      const opts = {
        action: 'patch',
        id: versionId,
        data: {
          patch: jsondiff.diff({}, { 'training-licence': true })
        }
      };
      return Promise.resolve()
        .then(() => this.projectVersion(opts))
        .then(() => this.models.ProjectVersion.query().findById(versionId))
        .then(version => {
          assert.equal(version.raCompulsory, true);
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
