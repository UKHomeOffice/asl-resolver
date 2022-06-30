const assert = require('assert');
const moment = require('moment');
const { project } = require('../../lib/resolvers');
const db = require('../helpers/db');
const generateUuid = require('uuid/v4');

const profileId = generateUuid();
const projectId = generateUuid();
const projectId2 = generateUuid();
const expiredProjectId = generateUuid();
const legacyProject = generateUuid();
const projectToForkId = generateUuid();

const holcId = generateUuid();
const licensingId = generateUuid();

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const establishmentId = 8201;

const isNowish = (date) => {
  return moment(date).isBetween(moment().subtract(5, 'seconds'), moment().add(5, 'seconds'));
};

describe('Project resolver', () => {

  before(() => {
    this.models = db.init();
    this.project = project({ models: this.models });
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
      .then(() => this.models.Profile.query().insert([
        {
          id: profileId,
          userId: 'abc123',
          title: 'Dr',
          firstName: 'Linford',
          lastName: 'Christie',
          address: '1 Some Road',
          postcode: 'A1 1AA',
          email: 'test1@example.com',
          telephone: '01234567890'
        },
        {
          id: licensingId,
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          asruUser: true,
          asruLicensing: true
        },
        {
          id: holcId,
          firstName: 'Holc',
          lastName: 'Hogan',
          email: 'holc@hogan.com'
        }
      ]));
  });

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  describe('delete amendments', () => {
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
            id: '8fb05730-f2ec-4d8f-8085-bbdc86937c54',
            projectId,
            data: {},
            status: 'draft',
            createdAt: new Date('2019-07-04').toISOString()
          },
          {
            id: '68d79bb1-3573-4402-ac08-7ac27dcbb39e',
            projectId,
            data: {},
            status: 'submitted',
            createdAt: new Date('2019-07-03').toISOString()
          },
          {
            id: 'ee871d64-cc87-470a-82d9-4a326c9c08dc',
            projectId,
            data: {},
            status: 'draft',
            createdAt: new Date('2019-07-02').toISOString()
          },
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId,
            data: {},
            status: 'granted',
            createdAt: new Date('2019-07-01').toISOString()
          },
          {
            id: 'b497b05a-f1e0-4596-8b02-60e129e2ab49',
            projectId,
            data: {},
            status: 'submitted',
            createdAt: new Date('2019-06-04').toISOString()
          },
          {
            id: '71e25eca-e0aa-4555-b09b-62f55b83e890',
            projectId,
            data: {},
            status: 'granted',
            createdAt: new Date('2019-06-03').toISOString()
          }
        ]));
    });

    it('only soft deletes versions since the most recent granted version', () => {
      const opts = {
        action: 'delete-amendments',
        id: projectId
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.queryWithDeleted())
        .then(versions => {
          versions.map(version => {
            if ([
              '8fb05730-f2ec-4d8f-8085-bbdc86937c54',
              '68d79bb1-3573-4402-ac08-7ac27dcbb39e',
              'ee871d64-cc87-470a-82d9-4a326c9c08dc'
            ].includes(version.id)) {
              assert(version.deleted);
              assert(moment(version.deleted).isValid(), 'version was soft deleted');
            }

            if ([
              '574266e5-ef34-4e34-bf75-7b6201357e75',
              'b497b05a-f1e0-4596-8b02-60e129e2ab49',
              '71e25eca-e0aa-4555-b09b-62f55b83e890'
            ].includes(version.id)) {
              assert(!version.deleted, 'version was not deleted');
            }
          });
        });
    });
  });

  describe('fork', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insertGraph({
          id: projectToForkId,
          status: 'active',
          title: 'Granted project',
          establishmentId: 8201,
          licenceHolderId: profileId,
          createdAt: new Date('2019-07-11').toISOString(),
          updatedAt: new Date('2019-07-11').toISOString()
        }))
        .then(() => this.models.ProjectVersion.query().insert({
          projectId: projectToForkId,
          status: 'granted',
          data: {
            title: 'Granted project'
          },
          raCompulsory: true
        }));
    });

    it('sets the asruVersion flag to true if submitted by asru user', () => {
      const opts = {
        action: 'fork',
        id: projectToForkId,
        changedBy: licensingId
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).limit(1).orderBy('createdAt', 'desc'))
        .then(versions => versions[0])
        .then(version => {
          assert.equal(version.asruVersion, true);
        });
    });

    it('doesn\'t update the asruVersion flag if status is not granted', () => {
      const opts = {
        action: 'fork',
        id: projectToForkId,
        changedBy: licensingId
      };
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).patch({ status: 'draft' }))
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).limit(1).orderBy('createdAt', 'desc'))
        .then(versions => versions[0])
        .then(version => {
          assert.equal(version.asruVersion, false);
        });
    });

    it('sets the asruVersion flag to false if submitted by establishment user', () => {
      const opts = {
        action: 'fork',
        id: projectToForkId,
        changedBy: holcId
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).limit(1).orderBy('createdAt', 'desc'))
        .then(versions => versions[0])
        .then(version => {
          assert.equal(version.asruVersion, false);
        });
    });

    it('sets the asruVersion flag to false if no changedBy is found', () => {
      const opts = {
        action: 'fork',
        id: projectToForkId
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).limit(1).orderBy('createdAt', 'desc'))
        .then(versions => versions[0])
        .then(version => {
          assert.equal(version.asruVersion, false);
        });
    });

    it('preserves the RA compulsory flag', () => {
      const opts = {
        action: 'fork',
        id: projectToForkId
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectToForkId }).orderBy('createdAt', 'desc').first())
        .then(version => {
          assert.equal(version.raCompulsory, true);
        });
    });
  });

  describe('submit-draft', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'inactive',
            title: 'New project',
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 1
          },
          {
            id: projectId2,
            status: 'active',
            title: 'Active project',
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 1,
            issueDate: new Date('2019-07-11').toISOString(),
            expiryDate: new Date('2022-07-11').toISOString(),
            licenceNumber: 'PP-627808'
          },
          {
            id: legacyProject,
            status: 'inactive',
            title: 'Legacy draft',
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 0
          }
        ]));
    });

    it('sets the species to the project for draft licence', () => {
      const version = {
        projectId,
        data: {
          species: [
            'mice',
            'rats'
          ]
        }
      };
      const opts = {
        id: projectId,
        action: 'submit-draft'
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          const expected = ['Mice', 'Rats'];
          assert.deepEqual(project.species, expected);
        });
    });

    it('sets the species to the project for legacy licence', () => {
      const version = {
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
        id: legacyProject,
        action: 'submit-draft'
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(legacyProject))
        .then(project => {
          const expected = ['Mice', 'Rats'];
          assert.deepEqual(project.species, expected);
        });
    });

    it('ignores falsy values', () => {
      const version = {
        projectId: legacyProject,
        data: {
          protocols: [
            {
              species: [
                {
                  foo: 'bar'
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
        id: legacyProject,
        action: 'submit-draft'
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(legacyProject))
        .then(project => {
          const expected = ['Rats'];
          assert.deepEqual(project.species, expected);
        });
    });

    it('does not update the species for active projects', () => {
      const version = {
        projectId: projectId2,
        data: {
          species: [
            'mice',
            'rats'
          ]
        }
      };
      const opts = {
        id: projectId2,
        action: 'submit-draft'
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(project => {
          assert.deepEqual(project.species, null);
        });
    });
  });

  describe('grant', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'inactive',
            title: 'New project',
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 1
          },
          {
            id: projectId2,
            status: 'active',
            title: 'Active project to be updated',
            issueDate: new Date('2019-07-11').toISOString(),
            expiryDate: new Date('2022-07-11').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 1
          },
          {
            id: legacyProject,
            status: 'active',
            title: 'Legacy project',
            issueDate: new Date('2019-07-11').toISOString(),
            expiryDate: new Date('2022-07-11').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId,
            createdAt: new Date('2019-07-11').toISOString(),
            updatedAt: new Date('2019-07-11').toISOString(),
            schemaVersion: 0
          }
        ]));
    });

    describe('RA', () => {
      describe('fork-ra', () => {
        it('creates a new draft RA model if nothing to fork', () => {
          const opts = {
            action: 'fork-ra',
            id: projectId
          };

          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId }).first())
            .then(ra => {
              assert.ok(ra);
              assert.deepEqual(ra.data, null);
              assert.deepEqual(ra.status, 'draft');
            });
        });

        it('forks the latest granted ra version', () => {
          const opts = {
            action: 'fork-ra',
            id: projectId
          };

          const ra = {
            projectId,
            data: {
              foo: 'bar'
            },
            status: 'granted'
          };

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(ra))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId }).orderBy('createdAt', 'desc'))
            .then(ras => {
              assert.equal(ras.length, 2);
              assert.equal(ras[0].status, 'draft');
              assert.deepEqual(ras[0].data, ra.data);
            });
        });

        it('forks the latest submitted ra version', () => {
          const opts = {
            action: 'fork-ra',
            id: projectId
          };

          const raVersion = {
            projectId,
            data: {
              foo: 'bar'
            },
            status: 'submitted'
          };

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersion))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId }).orderBy('createdAt', 'desc'))
            .then(ras => {
              assert.equal(ras.length, 2);
              assert.equal(ras[0].status, 'draft');
              assert.deepEqual(ras[0].data, raVersion.data);
            });
        });
      });

      describe('submit-ra', () => {
        it('submits a draft ra', () => {
          const opts = {
            action: 'submit-ra',
            id: projectId
          };

          const raVersion = {
            projectId,
            data: {
              foo: 'bar'
            },
            status: 'draft'
          };

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersion))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId }).first())
            .then(ra => {
              assert.ok(ra);
              assert.deepEqual(ra.data, raVersion.data);
              assert.equal(ra.status, 'submitted');
            });
        });

        it('submits latest draft ra', () => {
          const opts = {
            action: 'submit-ra',
            id: projectId
          };

          const raVersions = [
            {
              projectId,
              data: {
                foo: 'bar'
              },
              status: 'draft',
              createdAt: moment().subtract(1, 'day').toISOString()
            },
            {
              projectId,
              data: {
                foo: 'baz'
              },
              status: 'draft',
              createdAt: moment().toISOString()
            }
          ];

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId, status: 'submitted' }).first())
            .then(ra => {
              assert.ok(ra);
              assert.equal(ra.data.foo, 'baz');
            });
        });
      });

      describe('grant-ra', () => {

        it('grants the latest submitted ra version', () => {
          const opts = {
            action: 'grant-ra',
            id: projectId
          };

          const raVersions = [
            {
              projectId,
              data: {
                foo: 'bar'
              },
              status: 'submitted',
              createdAt: moment().subtract(1, 'day').toISOString()
            },
            {
              projectId,
              data: {
                foo: 'baz'
              },
              status: 'submitted',
              createdAt: moment().toISOString()
            }
          ];

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId, status: 'granted' }).first())
            .then(ra => {
              assert.ok(ra);
              assert.equal(ra.data.foo, 'baz');
            })
            .then(() => this.models.Project.query().findById(projectId))
            .then(project => {
              assert.ok(isNowish(project.raGrantedDate));
            });
        });

        it('returns returns project if latest version is granted (regression)', () => {
          const opts = {
            action: 'grant-ra',
            id: projectId
          };

          const raVersions = [
            {
              projectId,
              data: {
                foo: 'bar'
              },
              status: 'submitted',
              createdAt: moment().subtract(1, 'day').toISOString()
            },
            {
              projectId,
              data: {
                foo: 'baz'
              },
              status: 'granted',
              createdAt: moment().toISOString()
            }
          ];

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => this.project(opts))
            .then(project => {
              assert.equal(project.id, projectId);
            })
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId, status: 'granted' }).first())
            .then(ra => {
              assert.ok(ra);
              assert.equal(ra.data.foo, 'baz');
            });
        });

        it('does not allow granting of a non-submitted version', () => {
          const opts = {
            action: 'grant-ra',
            id: projectId,
            changedBy: holcId
          };

          const raVersions = [
            {
              projectId,
              data: {
                foo: 'bar'
              },
              status: 'submitted',
              createdAt: moment().subtract(1, 'day').toISOString()
            },
            {
              projectId,
              data: {},
              status: 'draft',
              createdAt: moment().toISOString()
            }
          ];
          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => {
              return assert.rejects(() => this.project(opts));
            });
        });

        it('allows granting of a non-submitted version if request made by ASRU user', () => {
          const opts = {
            action: 'grant-ra',
            id: projectId,
            changedBy: licensingId
          };

          const raVersions = [
            {
              projectId,
              status: 'draft',
              createdAt: moment().toISOString()
            }
          ];
          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.query().where({ projectId, status: 'granted' }).first())
            .then(ra => {
              assert.ok(ra);
            })
            .then(() => this.models.Project.query().findById(projectId))
            .then(project => {
              assert.ok(isNowish(project.raGrantedDate));
            });
        });
      });

      describe('delete-ra', () => {
        const raVersionId = generateUuid();

        it('deletes the specified RA', () => {
          const opts = {
            action: 'delete-ra',
            id: projectId,
            data: {
              raVersion: raVersionId
            }
          };

          const raVersions = [
            {
              id: raVersionId,
              projectId,
              data: {
                foo: 'bar'
              },
              status: 'submitted'
            }
          ];

          return Promise.resolve()
            .then(() => this.models.RetrospectiveAssessment.query().insert(raVersions))
            .then(() => this.project(opts))
            .then(() => this.models.RetrospectiveAssessment.queryWithDeleted().findById(raVersionId))
            .then(ra => {
              assert.ok(ra.deleted && moment(ra.deleted).isValid(), 'ra should have a valid deleted date');
            });
        });
      });
    });

    describe('species', () => {
      it('sets the species from the project version', () => {
        const opts = {
          action: 'grant',
          id: projectId
        };

        const version = {
          projectId,
          status: 'submitted',
          data: {
            title: 'Project with species',
            species: ['mice', 'rats'],
            'species-other': ['JABU', 'BABU'],
            'species-other-amphibians': ['FROGGY'],
            'species-other-birds': ['Phoenix'],
            'species-other-camelids': ['Humpback'],
            'species-other-dogs': ['Pug'],
            'species-other-domestic-fowl': ['Fried chicken'],
            'species-other-equidae': ['Zebra'],
            'species-other-fish': ['Blobfish'],
            'species-other-nhps': ['Bush baby'],
            'species-other-reptiles': ['Bastard lizard'],
            'species-other-rodents': ['Kangaroo']
          }
        };

        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(projectId))
          .then(project => {
            const expected = [
              'Mice',
              'Rats',
              'JABU',
              'BABU',
              'FROGGY',
              'Phoenix',
              'Humpback',
              'Pug',
              'Fried chicken',
              'Zebra',
              'Blobfish',
              'Bush baby',
              'Bastard lizard',
              'Kangaroo'
            ];
            assert.deepEqual(project.species, expected);
          });
      });

      it('updates the species from the project version', () => {
        const opts = {
          action: 'grant',
          id: projectId
        };

        const version = {
          projectId,
          status: 'submitted',
          data: {
            title: 'Project with species',
            species: ['mice', 'rats']
          }
        };

        return Promise.resolve()
          .then(() => this.models.Project.query().findById(projectId).patch({ species: ['mice'] }))
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(projectId))
          .then(project => {
            const expected = [
              'Mice',
              'Rats'
            ];
            assert.deepEqual(project.species, expected);
          });
      });

      it('sets species to null if blank', () => {
        const opts = {
          action: 'grant',
          id: projectId
        };

        const version = {
          projectId,
          status: 'submitted',
          data: {
            title: 'Project without species'
          }
        };

        return Promise.resolve()
          .then(() => this.models.Project.query().findById(projectId).patch({ species: ['mice'] }))
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(projectId))
          .then(project => {
            assert.deepEqual(project.species, null);
          });
      });

      it('sets species for legacy project', () => {
        const opts = {
          action: 'grant',
          id: legacyProject
        };

        const version = {
          projectId: legacyProject,
          status: 'submitted',
          data: {
            title: 'Legacy project with species',
            protocols: [
              {
                species: [
                  {
                    speciesId: '2'
                  },
                  {
                    speciesId: '5'
                  },
                  {
                    speciesId: '6'
                  }
                ]
              },
              {
                species: [
                  {
                    speciesId: '28',
                    'other-species-type': 'JABU'
                  },
                  {
                    speciesId: '28',
                    'other-species-type': 'BABU'
                  }
                ]
              }
            ]
          }
        };

        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(legacyProject))
          .then(project => {
            const expected = [
              'Amphibians',
              'Birds',
              'Camelids',
              'JABU',
              'BABU'
            ];
            assert.deepEqual(project.species, expected);
          });
      });
    });

    it('grants a new project updating the issue date, expiry date, title, and status', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const version = {
        projectId,
        status: 'submitted',
        data: {
          title: 'title of the newly granted project'
        }
      };
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          const expiryDate = moment(project.issueDate).add({ years: 5, months: 0 }).toISOString();
          assert.ok(project.licenceNumber, 'licence number was not generated');
          assert.equal(project.expiryDate, expiryDate, 'expiry date was not set to default 5 years');
          assert.equal(project.title, version.data.title, 'title was not updated');
          assert.equal(project.status, 'active', 'project was not activated');

          return this.models.ProjectVersion.query().findOne({ projectId, status: 'granted' })
            .then(version => {
              assert.ok(version, 'project version status not updated to granted');
            });
        });
    });

    it('sets the ra date to 6 months after expiry if required', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const version = {
        projectId,
        status: 'submitted',
        raCompulsory: true,
        data: {
          title: 'title of RA project'
        }
      };
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          const expectedRADate = moment(project.expiryDate).add({ months: 6 }).toISOString();
          assert.equal(project.raDate, expectedRADate);
        });
    });

    it('sets the ra date to null if not required', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const version = {
        projectId,
        status: 'submitted',
        data: {
          title: 'title of non RA project'
        }
      };
      const raDate = moment().add({ years: 5, months: 6 }).toISOString();
      return Promise.resolve()
        .then(() => this.models.Project.query().findById(projectId).patch({ raDate }))
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project.raDate, null);
        });
    });

    it('removes soft deleted protocols', () => {
      const PROTOCOL_1_ID = '0ac6500f-b618-4632-a00f-a01c5ee35e30';
      const PROTOCOL_2_ID = 'a5d76be3-f31d-42c2-9578-212be1d7a691';
      const opts = {
        action: 'grant',
        id: projectId
      };
      const version = {
        projectId,
        status: 'submitted',
        data: {
          protocols: [
            {
              id: PROTOCOL_1_ID
            },
            {
              id: PROTOCOL_2_ID,
              deleted: true
            }
          ]
        }
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId).eager('version'))
        .then(project => {
          assert.equal(project.version[0].data.protocols.length, 1, 'Expected protocol to be removed');
        });
    });

    it('removes soft deleted top level conditions', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const versionId = generateUuid();
      const version = {
        id: versionId,
        projectId,
        status: 'submitted',
        data: {
          conditions: [
            {
              autoAdded: true,
              key: 'non-purpose-bred-sched-2',
              path: 'non-purpose-bred-sched-2.versions.0',
              type: 'condition',
              deleted: true
            },
            {
              autoAdded: true,
              key: 'code-of-practice',
              path: 'code-of-practice.versions.0',
              type: 'condition'
            }
          ]
        }
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().findById(versionId))
        .then(version => {
          assert.equal(version.data.conditions.length, 1);
          assert.equal(version.data.conditions[0].key, 'code-of-practice');
        });
    });

    it('removes soft deleted protocol conditions', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const versionId = generateUuid();
      const version = {
        id: versionId,
        projectId,
        status: 'submitted',
        data: {
          protocols: [
            {
              conditions: [
                {
                  key: 'deleted-condition',
                  deleted: true
                },
                {
                  key: 'non-deleted-condition'
                }
              ]
            },
            {
              conditions: [
                {
                  key: 'deleted-condition-2',
                  deleted: true
                },
                {
                  key: 'deleted-condition-3',
                  deleted: true
                }
              ]
            }
          ]
        }
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().findById(versionId))
        .then(version => {
          assert.equal(version.data.protocols[0].conditions.length, 1);
          assert.equal(version.data.protocols[0].conditions[0].key, 'non-deleted-condition');
          assert.equal(version.data.protocols[1].conditions.length, 0);
        });
    });

    describe('condition reminders', () => {

      it('activates pending reminders for conditions that were granted', () => {
        const version = {
          id: generateUuid(),
          projectId,
          status: 'submitted',
          data: {
            conditions: [
              {
                autoAdded: true,
                key: 'non-purpose-bred-sched-2',
                path: 'non-purpose-bred-sched-2.versions.0',
                type: 'condition'
              },
              {
                autoAdded: true,
                key: 'code-of-practice',
                path: 'code-of-practice.versions.0',
                type: 'condition'
              }
            ]
          }
        };

        const reminders = [
          {
            modelType: 'project',
            modelId: projectId,
            establishmentId: 8201,
            deadline: '2022-07-01',
            conditionKey: 'non-purpose-bred-sched-2',
            status: 'pending'
          },
          {
            modelType: 'project',
            modelId: projectId,
            establishmentId: 8201,
            deadline: '2022-08-01',
            conditionKey: 'code-of-practice',
            status: 'pending'
          }
        ];

        const opts = {
          action: 'grant',
          id: projectId
        };

        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.models.Reminder.query().insert(reminders))
          .then(() => this.project(opts))
          .then(() => this.models.Reminder.query().where({ modelType: 'project', modelId: projectId }))
          .then(reminders => {
            assert.deepEqual(reminders.length, 2, 'there should be two reminders');
            assert.ok(reminders.every(r => r.status === 'active'), 'all the reminders should be active');
          });
      });

      it('soft deletes reminders that were orphaned by the removal of a condition', () => {
        const version = {
          id: generateUuid(),
          projectId,
          status: 'submitted',
          data: {
            conditions: [
              {
                autoAdded: true,
                key: 'code-of-practice',
                path: 'code-of-practice.versions.0',
                type: 'condition'
              }
            ]
          }
        };

        const reminders = [
          {
            modelType: 'project',
            modelId: projectId,
            establishmentId: 8201,
            deadline: '2022-07-01',
            conditionKey: 'non-purpose-bred-sched-2',
            status: 'active'
          },
          {
            modelType: 'project',
            modelId: projectId,
            establishmentId: 8201,
            deadline: '2022-08-01',
            conditionKey: 'code-of-practice',
            status: 'active'
          }
        ];

        const opts = {
          action: 'grant',
          id: projectId
        };

        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.models.Reminder.query().insert(reminders))
          .then(() => this.project(opts))
          .then(() => this.models.Reminder.query().where({ modelType: 'project', modelId: projectId }))
          .then(reminders => {
            assert.deepEqual(reminders.length, 1, 'there should be only one reminder');
            assert.deepEqual(reminders[0].conditionKey, 'code-of-practice', 'the reminder should be for the correct condition');
          });
      });

    });

    it('removes establishments if additional establishments is set to false', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const versionId = generateUuid();
      const version = {
        id: versionId,
        projectId,
        status: 'submitted',
        data: {
          'other-establishments': false,
          establishments: [
            {
              'establishment-id': 100
            },
            {
              'establishment-id': 101
            }
          ]
        }
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().findById(versionId))
        .then(version => {
          assert.deepStrictEqual(version.data.establishments, []);
        });

    });

    it('resolves if project version is already granted', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const version = {
        projectId,
        status: 'granted'
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(version))
        .then(() => this.project(opts));
    });

    it('does not touch old submitted versions if there is a more recent granted version', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const versions = [
        {
          projectId,
          status: 'submitted',
          data: {},
          createdAt: new Date('2019-12-15').toISOString()
        },
        {
          projectId,
          status: 'granted',
          data: {},
          createdAt: new Date('2019-12-16').toISOString()
        }
      ];

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => this.project(opts))
        .then(() => this.models.ProjectVersion.query().where({ projectId }).orderBy('createdAt', 'desc'))
        .then(versions => {
          assert.deepEqual(versions.map(v => v.status), ['granted', 'submitted']);
        });
    });

    it('throws if latest version is a draft', () => {
      const opts = {
        action: 'grant',
        id: projectId
      };
      const versions = [
        {
          projectId,
          status: 'submitted',
          data: {},
          createdAt: new Date('2019-12-15').toISOString()
        },
        {
          projectId,
          status: 'draft',
          data: {},
          createdAt: new Date('2019-12-16').toISOString()
        }
      ];

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => {
          assert.rejects(() => this.project(opts));
        });
    });

    describe('duration', () => {
      it('grants a new project updating the expiry date based on duration', () => {
        const opts = {
          action: 'grant',
          id: projectId
        };
        const version = {
          projectId,
          status: 'submitted',
          data: {
            title: 'title of the newly granted project',
            duration: {
              years: 3,
              months: 3
            }
          }
        };
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(projectId))
          .then(project => {
            const expiryDate = moment(project.issueDate).add(version.data.duration).toISOString();
            assert.equal(project.expiryDate, expiryDate, 'expiry date was not set from duration');
          });
      });

      it('allows a maximum of 5 years from issue date', () => {
        const opts = {
          action: 'grant',
          id: projectId
        };
        const version = {
          projectId,
          status: 'submitted',
          data: {
            title: 'title of the newly granted project',
            duration: {
              years: 7,
              months: 6
            }
          }
        };
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(version))
          .then(() => this.project(opts))
          .then(() => this.models.Project.query().findById(projectId))
          .then(project => {
            const expiryDate = moment(project.issueDate).add({ years: 5, months: 0 }).toISOString();
            assert.equal(project.expiryDate, expiryDate, 'maximum duration of 5 years not honoured');
          });
      });

      describe('validation', () => {
        const tests = [
          { expected: 60 },
          { duration: {}, expected: 60 },
          { duration: { years: 5 }, expected: 60 },
          { duration: { years: 5, months: null }, expected: 60 },
          { duration: { years: null, months: null }, expected: 60 },
          { duration: { years: 0, months: 0 }, expected: 60 },
          { duration: { years: 5, months: 6 }, expected: 60 },
          { duration: { years: 10, months: 25 }, expected: 60 },
          { duration: { years: 0, months: 25 }, expected: 60 },
          { duration: { years: 2, months: 25 }, expected: 24 },
          { duration: { years: 0, months: 3 }, expected: 3 }
        ];

        const opts = {
          action: 'grant',
          id: projectId
        };

        const runTest = ({ duration, expected }, index) => {
          const version = {
            projectId,
            status: 'submitted',
            data: { duration }
          };
          it(`Testing expiryDate correctly set from duration - ${index + 1}`, () => {
            return Promise.resolve()
              .then(() => this.models.ProjectVersion.query().insert(version))
              .then(() => this.project(opts))
              .then(() => this.models.Project.query().findById(projectId))
              .then(project => {
                const issueDate = moment(project.issueDate);
                const expiryDate = moment(project.expiryDate);
                let diff;

                // handle dates where the expiry month has more days than the issue month
                if (issueDate.date() < expiryDate.date()) {
                  diff = expiryDate.diff(issueDate, 'months');
                } else {
                  diff = issueDate.diff(expiryDate, 'months');
                }
                assert.equal(Math.abs(diff), expected);
              });
          });
        };
        tests.forEach(runTest);
      });
    });

    it('Updates active project ignoring expiry as not changed since granted', () => {
      const opts = {
        action: 'grant',
        id: projectId2
      };
      const versions = [
        {
          projectId: projectId2,
          status: 'granted',
          data: {
            title: 'New title for updated project',
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-12-17').toISOString()
        },
        {
          projectId: projectId2,
          status: 'submitted',
          data: {
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-12-18').toISOString()
        }
      ];
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(previous => {
          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.query().findById(projectId2))
            .then(project => {
              assert.equal(project.expiryDate, previous.expiryDate, 'Expiry date was updated');
            });
        });
    });

    it('Updates expiry date if duration changed', () => {
      const opts = {
        action: 'grant',
        id: projectId2
      };
      const versions = [
        {
          projectId: projectId2,
          status: 'granted',
          data: {
            title: 'New title for updated project',
            duration: {
              years: 3,
              months: 0
            }
          },
          createdAt: new Date('2019-12-17').toISOString()
        },
        {
          projectId: projectId2,
          status: 'submitted',
          data: {
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-12-18').toISOString()
        }
      ];
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(previous => {
          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.query().findById(projectId2))
            .then(project => {
              const expiryDate = moment(previous.issueDate).add(versions[1].data.duration).toISOString();
              assert.equal(project.expiryDate, expiryDate, 'Expiry date not updated');
            });
        });
    });

    it('updates the amendedDate if an amendment is granted', () => {
      const opts = {
        action: 'grant',
        id: projectId2
      };
      const versions = [
        {
          projectId: projectId2,
          status: 'granted',
          data: {
            title: 'New title for updated project',
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-07-11').toISOString(),
          updatedAt: new Date('2019-07-11').toISOString()
        },
        {
          projectId: projectId2,
          status: 'submitted',
          data: {
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-10-11').toISOString(),
          updatedAt: new Date('2019-10-11').toISOString()
        }
      ];
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(previous => {
          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.query().findById(projectId2))
            .then(project => {
              assert(project.amendedDate, 'amendment date was set');
              assert(isNowish(project.amendedDate), 'the amended date is set to the granted time');
            });
        });
    });

    it('does not set the amendedDate if there is no previous granted version', () => {
      const opts = {
        action: 'grant',
        id: projectId2
      };
      const versions = [
        {
          projectId: projectId2,
          status: 'submitted',
          data: {
            duration: {
              years: 5,
              months: 0
            }
          },
          createdAt: new Date('2019-10-11').toISOString(),
          updatedAt: new Date('2019-10-11').toISOString()
        }
      ];
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert(versions))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(previous => {
          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.query().findById(projectId2))
            .then(project => {
              assert.equal(project.amendedDate, null, 'amendment date was not set');
            });
        });
    });

    describe('Additional availability', () => {
      it('activates existing projectEstablishment joins', () => {
        const opts = {
          action: 'grant',
          id: projectId2
        };
        const versions = [
          {
            projectId: projectId2,
            status: 'submitted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202
                }
              ],
              'other-establishments': true
            }
          }
        ];
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(versions))
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId: projectId2, status: 'draft' }))
          .then(() => this.project(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId: projectId2 }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment.status, 'active');
          });
      });

      it('deactivates existing joins that have been removed', () => {
        const opts = {
          action: 'grant',
          id: projectId2
        };
        const lastGrantedVersion = generateUuid();
        const versionToGrant = generateUuid();
        const versions = [
          {
            id: lastGrantedVersion,
            projectId: projectId2,
            status: 'granted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202
                }
              ],
              'other-establishments': true
            },
            createdAt: new Date('2019-10-11').toISOString(),
            updatedAt: new Date('2019-10-11').toISOString()
          },
          {
            id: versionToGrant,
            projectId: projectId2,
            status: 'submitted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202,
                  deleted: true
                }
              ],
              'other-establishments': true
            },
            createdAt: new Date('2020-10-11').toISOString(),
            updatedAt: new Date('2020-10-11').toISOString()
          }
        ];
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(versions))
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId: projectId2, status: 'active' }))
          .then(() => this.project(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId: projectId2 }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment.status, 'removed');
            assert.equal(projectEstablishment.versionId, lastGrantedVersion);
          })
          .then(() => this.models.ProjectVersion.query().findById(versionToGrant))
          .then(version => {
            assert.equal(version.data.establishments.length, 0, 'deleted establishments are stripped from the granted version data');
          });
      });

      it('deactivates existing joins if no other establishments selected', () => {
        const opts = {
          action: 'grant',
          id: projectId2
        };
        const lastGrantedVersion = generateUuid();
        const versions = [
          {
            id: lastGrantedVersion,
            projectId: projectId2,
            status: 'granted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202
                }
              ],
              'other-establishments': true
            },
            createdAt: new Date('2019-10-11').toISOString(),
            updatedAt: new Date('2019-10-11').toISOString()
          },
          {
            id: generateUuid(),
            projectId: projectId2,
            status: 'submitted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202
                }
              ],
              'other-establishments': false
            },
            createdAt: new Date('2020-10-11').toISOString(),
            updatedAt: new Date('2020-10-11').toISOString()
          }
        ];
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(versions))
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId: projectId2, status: 'active' }))
          .then(() => this.project(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId: projectId2 }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment.status, 'removed');
            assert.equal(projectEstablishment.versionId, lastGrantedVersion);
          });
      });

      it('reactivates removed joins that are readded', () => {
        const opts = {
          action: 'grant',
          id: projectId2
        };
        const lastGrantedVersion = generateUuid();
        const versions = [
          {
            id: lastGrantedVersion,
            projectId: projectId2,
            status: 'granted',
            data: {
              establishments: []
            },
            createdAt: new Date('2019-10-11').toISOString(),
            updatedAt: new Date('2019-10-11').toISOString()
          },
          {
            id: generateUuid(),
            projectId: projectId2,
            status: 'submitted',
            data: {
              establishments: [
                {
                  'establishment-id': 8202
                }
              ],
              'other-establishments': true
            },
            createdAt: new Date('2020-10-11').toISOString(),
            updatedAt: new Date('2020-10-11').toISOString()
          }
        ];
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert(versions))
          .then(() => this.models.ProjectEstablishment.query().insert({ establishmentId: 8202, projectId: projectId2, status: 'removed', versionId: lastGrantedVersion }))
          .then(() => this.project(opts))
          .then(() => this.models.ProjectEstablishment.query().where({ establishmentId: 8202, projectId: projectId2 }).first())
          .then(projectEstablishment => {
            assert.equal(projectEstablishment.status, 'active');
            assert.equal(projectEstablishment.versionId, null);
          });
      });

    });
  });

  describe('create', () => {
    it('creates a new project with an empty project version if called without a version param', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query())
        .then(projects => {
          assert.equal(projects.length, 1, '1 project should exist in table');
          return this.models.ProjectVersion.query().where({ projectId: projects[0].id })
            .then(versions => {
              assert.equal(versions.length, 1, 'version should have been created');
              assert.deepEqual(versions[0].data, null, 'version data should be empty');
            });
        });
    });

    it('creates a new project and passes version data to a new version', () => {
      const data = {
        a: 1,
        b: 2,
        c: null,
        d: false,
        e: true,
        title: 'This is the title'
      };

      const opts = {
        action: 'create',
        data: {
          establishmentId,
          licenceHolderId: profileId,
          version: {
            data
          }
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query())
        .then(projects => {
          assert(projects.length === 1, 'project should have been added');
          assert.equal(projects[0].title, data.title, 'title should have been added to project');
          return this.models.ProjectVersion.query().where({ projectId: projects[0].id })
            .then(versions => {
              assert(versions.length === 1, 'version should be created');
              assert.deepEqual(versions[0].data, data, 'version data should have been populated');
            });
        });
    });

    it('adds the licence holder to both the project and the version', () => {
      const opts = {
        action: 'create',
        data: {
          title: 'Testing licence holder',
          establishmentId: 8201,
          licenceHolderId: profileId,
          version: {
            data: {
              title: 'Testing licence holder'
            }
          }
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => {
          return this.models.Project.query()
            .findOne({ title: opts.data.title })
            .withGraphFetched('version');
        })
        .then(project => {
          assert.deepStrictEqual(project.licenceHolderId, profileId);
          assert.deepStrictEqual(project.version[0].licenceHolderId, profileId);
        });
    });

    it('removes establishments and transfer to est from version', () => {
      const data = {
        establishments: [
          {
            'establishment-id': 8201,
            name: 'University of Croydon',
            someField: 'Some content'
          }
        ],
        transferToEstablishment: 8202,
        transferToEstablishmentName: 'Marvell Pharmaceutical'
      };

      const expected = {
        establishments: [
          {
            someField: 'Some content'
          }
        ],
        transferToEstablishment: null,
        transferToEstablishmentName: null
      };

      const opts = {
        action: 'create',
        data: {
          establishmentId,
          licenceHolderId: profileId,
          version: {
            data
          }
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query())
        .then(projects => {
          assert(projects.length === 1, 'project should have been added');
          return this.models.ProjectVersion.query().where({ projectId: projects[0].id })
            .then(versions => {
              assert(versions.length === 1, 'version should be created');
              assert.deepEqual(versions[0].data, expected, 'establishment and transfer info should have been stripped');
            });
        });
    });

    it('adds id properties to protocol species details if missing', () => {
      const data = {
        title: 'Species IDs',
        species: ['mice', 'rats'],
        protocols: [
          {
            title: 'Mouse protocol',
            species: ['mice'],
            speciesDetails: [
              { value: 'mice', 'maximum-times-used': '100' }
            ]
          },
          {
            title: 'Rat protocol',
            species: ['rats'],
            speciesDetails: [
              { value: 'rats', 'maximum-times-used': '200' }
            ]
          },
          {
            title: 'Both protocol',
            species: ['mice', 'rats'],
            speciesDetails: [
              { value: 'mice', 'maximum-times-used': '300' },
              { value: 'rats', 'maximum-times-used': '400' }
            ]
          }
        ]
      };

      const opts = {
        action: 'create',
        data: {
          establishmentId,
          licenceHolderId: profileId,
          version: {
            data
          }
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query())
        .then(projects => {
          return this.models.ProjectVersion.query().where({ projectId: projects[0].id })
            .then(versions => {
              assert(versions.length === 1, 'version not added');
              const version = versions[0].data;
              assert.equal(version.protocols.length, 3, 'version should have 3 protocols');
              assert.equal(version.protocols[0].title, 'Mouse protocol');
              assert.equal(version.protocols[1].title, 'Rat protocol');
              assert.equal(version.protocols[2].title, 'Both protocol');

              assert.ok(version.protocols[0].speciesDetails[0].id.match(uuid));
              assert.equal(version.protocols[0].speciesDetails[0].value, 'mice');
              assert.equal(version.protocols[0].speciesDetails[0]['maximum-times-used'], '100');

              assert.ok(version.protocols[1].speciesDetails[0].id.match(uuid));
              assert.equal(version.protocols[1].speciesDetails[0].value, 'rats');
              assert.equal(version.protocols[1].speciesDetails[0]['maximum-times-used'], '200');

              assert.ok(version.protocols[2].speciesDetails[0].id.match(uuid));
              assert.equal(version.protocols[2].speciesDetails[0].value, 'mice');
              assert.equal(version.protocols[2].speciesDetails[0]['maximum-times-used'], '300');

              assert.ok(version.protocols[2].speciesDetails[1].id.match(uuid));
              assert.equal(version.protocols[2].speciesDetails[1].value, 'rats');
              assert.equal(version.protocols[2].speciesDetails[1]['maximum-times-used'], '400');
            });
        });
    });
  });

  describe('transfer', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert({
          id: 8203,
          name: 'Univerty of Cheese'
        }))
        .then(() => this.models.Project.query().insert({
          id: projectId,
          status: 'active',
          establishmentId: 8201,
          licenceHolderId: profileId,
          title: 'Project to transfer'
        }));
    });

    it('throws an error if the version to transfer isn\'t submitted', () => {
      const opts = {
        action: 'transfer',
        id: projectId,
        data: {
          establishmentId: 8203
        }
      };
      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().insert({
          projectId,
          status: 'draft',
          data: {
            foo: 'bar',
            transferToEstablishment: 8203
          }
        }))
        .then(() => this.project(opts))
        .catch(err => {
          assert.equal(err.message, 'Cannot transfer unsubmitted version');
        });
    });

    describe('successful transfer', () => {
      beforeEach(() => {
        this.input = {
          action: 'transfer',
          id: projectId,
          data: {
            establishmentId: 8203
          }
        };
        return Promise.resolve()
          .then(() => this.models.ProjectVersion.query().insert({
            projectId,
            status: 'submitted',
            data: {
              foo: 'bar',
              transferToEstablishment: 8203
            }
          }));
      });

      it('clones the project into the new establishment updating transferredInDate and pointers to old est and proj', async () => {
        await this.project(this.input);
        const newProject = await this.models.Project.query().findOne({ establishmentId: 8203 });
        const oldProject = await this.models.Project.query().findById(projectId);

        assert.equal(newProject.title, 'Project to transfer');
        assert.equal(newProject.status, 'active');
        assert(isNowish(newProject.transferredInDate));
        assert.equal(newProject.previousEstablishmentId, 8201);
        assert.equal(newProject.previousProjectId, oldProject.id);
      });

      it('creates a clone of the version under the new project, removing the transfer flag', async () => {
        await this.project(this.input);

        const { id } = await this.models.Project.query().findOne({ establishmentId: 8203 });
        const version = await this.models.ProjectVersion.query().findOne({ projectId: id });
        assert.equal(version.status, 'granted');
        assert.equal(version.data.foo, 'bar');
        assert.equal(version.data.transferToEstablishment, undefined);
      });

      it('updates the status of the old project to transferred, updates transferredOutDate and new proj/est pointers', async () => {
        await this.project(this.input);

        const newProject = await this.models.Project.query().findOne({ establishmentId: 8203 });
        const oldProject = await this.models.Project.query().findById(projectId);

        assert.equal(oldProject.status, 'transferred');
        assert(isNowish(oldProject.transferredOutDate));
        assert.equal(oldProject.transferEstablishmentId, 8203);
        assert.equal(oldProject.transferProjectId, newProject.id);
      });

      it('creates additional availability relations from the new project', async () => {
        await this.models.ProjectVersion.query().findOne({ projectId }).patch({
          data: {
            transferToEstablishment: 8203,
            'other-establishments': true,
            establishments: [
              { 'establishment-id': 8201 },
              { 'establishment-id': 8202 }
            ]
          }
        });

        await this.project(this.input);
        const newProject = await this.models.Project.query()
          .withGraphFetched('additionalEstablishments')
          .findOne({ establishmentId: 8203 });

        assert.equal(newProject.additionalEstablishments.length, 2);
        assert.ok(newProject.additionalEstablishments.find(e => e.id === 8201 && e.status === 'active'), 'an active association with establishment id 8201 should have been created');
        assert.ok(newProject.additionalEstablishments.find(e => e.id === 8202 && e.status === 'active'), 'an active association with establishment id 8202 should have been created');
      });

      it('removes any draft AA records created during transfer process', async () => {
        await this.models.ProjectVersion.query().findOne({ projectId }).patch({
          data: {
            transferToEstablishment: 8203,
            'other-establishments': true,
            establishments: [
              { 'establishment-id': 8201 },
              { 'establishment-id': 8202 }
            ]
          }
        });
        await this.models.ProjectEstablishment.query().insert([
          { projectId, establishmentId: 8201, status: 'draft' },
          { projectId, establishmentId: 8202, status: 'draft' }
        ]);

        await this.project(this.input);

        const oldProject = await this.models.Project.query()
          .withGraphFetched('additionalEstablishments')
          .findById(projectId);

        assert.deepEqual(oldProject.additionalEstablishments, []);
      });

      it('leaves pre-existing AA records created prior to transfer process', async () => {
        await this.models.ProjectVersion.query().findOne({ projectId }).patch({
          data: {
            transferToEstablishment: 8203,
            'other-establishments': true,
            establishments: [
              { 'establishment-id': 8201 },
              { 'establishment-id': 8202 }
            ]
          }
        });
        await this.models.ProjectEstablishment.query().insert([
          { projectId, establishmentId: 8201, status: 'draft' },
          { projectId, establishmentId: 8202, status: 'active' }
        ]);

        await this.project(this.input);

        const oldProject = await this.models.Project.query()
          .withGraphFetched('additionalEstablishments')
          .findById(projectId);

        assert.equal(oldProject.additionalEstablishments.length, 1);
        assert.equal(oldProject.additionalEstablishments[0].id, 8202);
      });
    });
  });

  describe('transfer-draft', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Establishment.query().insert([
          {
            id: 8203,
            name: 'Unassociated Establishment'
          },
          {
            id: 8204,
            name: 'University of Life'
          }
        ]))
        .then(() => this.models.Permission.query().insert([
          {
            establishmentId: 8201,
            profileId,
            role: 'basic'
          },
          {
            establishmentId: 8204,
            profileId,
            role: 'basic'
          }
        ]).returning('*'))
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            establishmentId: 8201,
            licenceHolderId: profileId
          },
          {
            id: projectId2,
            status: 'inactive',
            establishmentId: 8201,
            licenceHolderId: profileId
          }
        ]));
    });

    it('cannot change the establishment for a non-draft project', () => {
      const opts = {
        action: 'transfer-draft',
        id: projectId,
        data: {
          establishmentId: 8204
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .catch(err => {
          assert.equal(err.message, 'Cannot transfer non-draft projects');
        });
    });

    it('cannot transfer the project to an establishment the licence holder is not associated with', () => {
      const opts = {
        action: 'transfer-draft',
        id: projectId2,
        data: {
          establishmentId: 8203
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .catch(err => {
          assert.equal(err.message, 'Cannot transfer to an establishment the licence holder is not associated with');
        });
    });

    it('can change the primary establishment for a draft project', () => {
      const opts = {
        action: 'transfer-draft',
        id: projectId2,
        data: {
          establishmentId: 8204
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(project => {
          assert.equal(project.establishmentId, 8204);
        });
    });
  });

  describe('delete-amendments', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'inactive',
            establishmentId: 8201,
            licenceHolderId: profileId
          },
          {
            id: projectId2,
            status: 'active',
            establishmentId: 8201,
            licenceHolderId: profileId,
            issueDate: new Date().toISOString(),
            expiryDate: moment(new Date()).add(5, 'years').toISOString()
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            projectId,
            status: 'submitted',
            createdAt: new Date().toISOString()
          },
          {
            projectId,
            status: 'submitted',
            createdAt: moment().subtract(5, 'minutes').toISOString()
          },
          {
            projectId,
            status: 'withdrawn',
            createdAt: moment().subtract(10, 'minutes').toISOString()
          },
          {
            projectId: projectId2,
            status: 'submitted',
            createdAt: new Date().toISOString()
          },
          {
            projectId: projectId2,
            status: 'submitted',
            createdAt: moment().subtract(5, 'minutes').toISOString()
          },
          {
            projectId: projectId2,
            status: 'granted',
            createdAt: moment().subtract(10, 'minutes').toISOString()
          },
          {
            projectId: projectId2,
            status: 'withdrawn',
            createdAt: moment().subtract(15, 'minutes').toISOString()
          }
        ]));
    });

    it('soft deletes project and all versions if project is a draft', () => {
      const opts = {
        action: 'delete-amendments',
        id: projectId
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project, null);
        })
        .then(() => this.models.ProjectVersion.query().where({ projectId }))
        .then(versions => {
          assert.equal(versions.length, 0);
        });
    });

    it('soft deletes all versions since the most recent granted version if not a draft', () => {
      const opts = {
        action: 'delete-amendments',
        id: projectId2
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(project => {
          assert.ok(project);
        })
        .then(() => this.models.ProjectVersion.query().where({ projectId: projectId2 }))
        .then(versions => {
          assert.equal(versions.length, 2);
        });
    });

    it('soft deletes all pending reminders', () => {
      const reminders = [
        {
          modelType: 'project',
          modelId: projectId2,
          establishmentId: 8201,
          deadline: '2022-07-01',
          conditionKey: 'non-purpose-bred-sched-2',
          status: 'pending'
        },
        {
          modelType: 'project',
          modelId: projectId2,
          establishmentId: 8201,
          deadline: '2022-08-01',
          conditionKey: 'code-of-practice',
          status: 'pending'
        },
        {
          modelType: 'project',
          modelId: projectId2,
          establishmentId: 8201,
          deadline: '2022-09-01',
          conditionKey: 'nmbas',
          status: 'active'
        }
      ];

      const opts = {
        action: 'delete-amendments',
        id: projectId2
      };

      return Promise.resolve()
        .then(() => this.models.Reminder.query().insert(reminders))
        .then(() => this.project(opts))
        .then(() => this.models.Reminder.query().where({ modelType: 'project', modelId: projectId2 }))
        .then(reminders => {
          assert.deepEqual(reminders.length, 1, 'there should be only one reminder');
          assert.deepEqual(reminders[0].status, 'active', 'the reminder should still be active');
          assert.deepEqual(reminders[0].conditionKey, 'nmbas', 'the reminder should be for the correct condition');
        });
    });
  });

  describe('revoke', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            title: 'Active project to be revoked',
            issueDate: moment().toISOString(),
            expiryDate: moment().add(5, 'years').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId
          },
          {
            id: expiredProjectId,
            status: 'expired',
            title: 'Expired project',
            issueDate: moment('2015-07-01').toISOString(),
            expiryDate: moment('2020-07-01').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            projectId,
            status: 'granted',
            data: {}
          },
          {
            projectId: expiredProjectId,
            status: 'granted',
            data: {}
          }
        ]));
    });

    it('can revoke an active project', () => {
      const opts = {
        action: 'revoke',
        id: projectId,
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project.status, 'revoked');
          assert.ok(project.revocationDate && moment(project.revocationDate).isValid(), 'revocation date should be set');
        });
    });

    it('cannot revoke an expired project', () => {
      const opts = {
        action: 'revoke',
        id: expiredProjectId,
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };

      return Promise.resolve()
        .then(() => assert.rejects(() => this.project(opts)))
        .then(() => this.models.Project.query().findById(expiredProjectId))
        .then(project => {
          assert.equal(project.status, 'expired');
          assert.equal(project.revocationDate, null);
        });
    });

    it('updates the RA date to six months after revocationDate (optional)', () => {
      const opts = {
        action: 'revoke',
        id: projectId,
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };

      const data = {
        retrospectiveAssessment: true
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().where({ projectId }).patch({ data }))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          const expected = moment(project.revocationDate).add(6, 'months').toISOString();
          assert.equal(project.raDate, expected);
        });
    });

    it('updates the RA date to six months after revocationDate (compulsory), ignoring value from data.', () => {
      const opts = {
        action: 'revoke',
        id: projectId,
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };

      const data = {
        retrospectiveAssessment: false
      };

      return Promise.resolve()
        .then(() => this.models.ProjectVersion.query().where({ projectId }).patch({ raCompulsory: true, data }))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          const expected = moment(project.revocationDate).add(6, 'months').toISOString();
          assert.equal(project.raDate, expected);
        });
    });

    it('sets the RA date to null if ra not required', () => {
      const opts = {
        action: 'revoke',
        id: projectId,
        data: {
          establishmentId,
          licenceHolderId: profileId
        }
      };

      const data = {
        retrospectiveAssessment: false
      };

      const raDate = moment().add(6, 'months').toISOString();

      return Promise.resolve()
        .then(() => this.models.Project.query().findById(projectId).patch({ raDate }))
        .then(() => this.models.ProjectVersion.query().where({ projectId }).patch({ data }))
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project.raDate, null);
        });
    });
  });

  describe('update-issue-date', () => {
    beforeEach(() => {
      const originalIssueDate = new Date('2020-01-17').toISOString();
      const originalExpiryDate = new Date('2025-01-17').toISOString();
      const duration = { years: 5, months: 0 };

      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            title: 'Active project wrong issue date',
            issueDate: originalIssueDate,
            expiryDate: originalExpiryDate,
            establishmentId: 8201,
            licenceHolderId: profileId
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId,
            data: {
              duration
            },
            status: 'granted',
            createdAt: originalIssueDate
          }
        ]));
    });

    it('can change the issue date of a project', () => {
      const newIssueDate = new Date('2018-08-15').toISOString();
      const expectedExpiryDate = new Date('2023-08-15').toISOString();

      const opts = {
        action: 'update-issue-date',
        id: projectId,
        data: {
          issueDate: newIssueDate
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project.issueDate, newIssueDate, 'issue date was updated correctly');
          assert.equal(project.expiryDate, expectedExpiryDate, 'expiry date was updated correctly');
        });
    });
  });

  describe('update-licence-number', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            title: 'Active project stub wrong licence number',
            licenceNumber: 'ABC-123',
            issueDate: new Date('2020-01-17').toISOString(),
            expiryDate: new Date('2025-01-17').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId,
            isLegacyStub: true
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId,
            data: {
              duration: { years: 5, months: 0 }
            },
            status: 'granted',
            createdAt: new Date('2020-01-17').toISOString()
          }
        ]));
    });

    it('cannot change the licence number of a standard project', () => {
      return Promise.resolve()
        .then(() => this.models.Project.query().findById(projectId).patch({ isLegacyStub: false }))
        .then(() => {
          const newLicenceNumber = 'XYZ-789';

          const opts = {
            action: 'update-licence-number',
            id: projectId,
            data: {
              licenceNumber: newLicenceNumber
            }
          };

          return Promise.resolve()
            .then(() => this.project(opts))
            .catch(err => {
              assert.equal(err.message, 'Can only update the licence number for legacy stubs');
            });
        });
    });

    it('can change the licence number of a project stub', () => {
      const newLicenceNumber = 'XYZ-789';

      const opts = {
        action: 'update-licence-number',
        id: projectId,
        data: {
          licenceNumber: newLicenceNumber
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.equal(project.licenceNumber, newLicenceNumber, 'licence number was updated correctly');
        });
    });
  });

  describe('change ppl holder', () => {
    beforeEach(() => {
      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            status: 'active',
            title: 'Licence to change',
            licenceNumber: 'ABC-123',
            issueDate: new Date('2020-01-17').toISOString(),
            expiryDate: new Date('2025-01-17').toISOString(),
            amendedDate: new Date('2021-01-17').toISOString(),
            establishmentId: 8201,
            licenceHolderId: profileId
          },
          {
            id: projectId2,
            status: 'inactive',
            title: 'draft',
            establishmentId: 8201,
            licenceHolderId: profileId
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId: projectId,
            data: {
              'experience-knowledge': 'Previous applicant experience'
            },
            status: 'granted',
            createdAt: new Date('2020-01-17').toISOString()
          },
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e76',
            projectId: projectId2,
            data: {
              'experience-knowledge': 'Previous applicant experience'
            },
            status: 'draft',
            createdAt: new Date('2020-01-17').toISOString()
          }
        ]));
    });

    it('creates a new granted version for granted PPLs', () => {
      const opts = {
        action: 'update',
        id: projectId,
        data: {
          licenceHolderId: holcId,
          'experience-knowledge': 'Some new experience content'
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().eager('version').findById(projectId))
        .then(project => {
          assert.equal(project.version.length, 2);
          assert.ok(project.version.every(version => version.status === 'granted'));
          assert.equal(project.version[0].data['experience-knowledge'], 'Previous applicant experience');
          assert.equal(project.version[1].data['experience-knowledge'], 'Some new experience content');
        });
    });

    it('updates the amended date on a granted project', () => {
      const opts = {
        action: 'update',
        id: projectId,
        data: {
          licenceHolderId: holcId
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId))
        .then(project => {
          assert.ok(isNowish(project.amendedDate));
        });
    });

    it('updates the current draft version for draft PPLs', () => {
      const opts = {
        action: 'update',
        id: projectId2,
        data: {
          licenceHolderId: holcId,
          'experience-knowledge': 'Some new experience content'
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().eager('version').findById(projectId2))
        .then(project => {
          assert.equal(project.version.length, 1);
          assert.equal(project.version[0].status, 'draft');
          assert.equal(project.version[0].data['experience-knowledge'], 'Some new experience content');
        });
    });

    it('does not update the amended date on a draft project', () => {
      const opts = {
        action: 'update',
        id: projectId2,
        data: {
          licenceHolderId: holcId
        }
      };
      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().findById(projectId2))
        .then(project => {
          assert.equal(project.amendedDate, null);
        });
    });

  });

  describe('Conversion of legacy project licences', () => {

    it('can create a project stub for a legacy licence', () => {
      const title = 'Digitised Paper Licence Stub';
      const licenceNumber = 'XXX-123-XXX';
      const issueDate = new Date('2018-08-15').toISOString();
      const expectedExpiryDate = new Date('2023-08-15').toISOString();

      const duration = {
        years: 5,
        months: 0
      };

      const opts = {
        action: 'create',
        data: {
          title,
          establishmentId,
          licenceHolderId: profileId,
          licenceNumber,
          issueDate,
          isLegacyStub: true,
          version: {
            data: {
              title,
              duration
            }
          }
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query().eager('version'))
        .then(projects => projects[0])
        .then(project => {
          assert.equal(project.status, 'active', 'the project should be active');
          assert.equal(project.isLegacyStub, true, 'the project should be a legacy stub');
          assert.equal(project.schemaVersion, 0, 'the schema version should be 0');
          assert.equal(project.migratedId, 'legacy-conversion', 'the project should have a migrated id of "legacy-conversion"');
          assert.equal(project.establishmentId, establishmentId, 'the project should have an establishment id');
          assert.equal(project.licenceHolderId, profileId, 'the project should have a licence holder id');
          assert.equal(project.licenceNumber, licenceNumber, 'the project should have a licence number');
          assert.equal(project.issueDate, issueDate, 'the project should have an issue date');
          assert.equal(project.expiryDate, expectedExpiryDate, 'the project should have an expiry date');

          assert.equal(project.version.length, 1, 'there should be a single project version');

          const version = project.version[0];
          assert.equal(version.status, 'granted', 'the version should be granted');
          assert.equal(version.asruVersion, true, 'the version should be an asru version');
          assert.equal(version.data.title, title, 'the version should have the same title as the project');
          assert.deepEqual(version.data.duration, duration, 'the version should have the correct duration');
          assert.equal(version.data.isLegacyStub, true, 'the version should be flagged as a legacy stub');
        });
    });

    it('expires the project stub if the expiry is in the past', () => {
      const title = 'Expired Licence Stub';
      const licenceNumber = 'XXX-123-XXX';
      const issueDate = new Date('2016-08-15').toISOString();
      const expectedExpiryDate = new Date('2018-08-15').toISOString();

      const duration = {
        years: 2,
        months: 0
      };

      const opts = {
        action: 'create',
        data: {
          title,
          establishmentId,
          licenceHolderId: profileId,
          licenceNumber,
          issueDate,
          isLegacyStub: true,
          version: {
            data: {
              title,
              duration
            }
          }
        }
      };

      return Promise.resolve()
        .then(() => this.project(opts))
        .then(() => this.models.Project.query())
        .then(projects => projects[0])
        .then(project => {
          assert.equal(project.status, 'expired', 'the project should be expired');
          assert.equal(project.isLegacyStub, true, 'the project should be a legacy stub');
          assert.equal(project.schemaVersion, 0, 'the schema version should be 0');
          assert.equal(project.issueDate, issueDate, 'the project should have an issue date');
          assert.equal(project.expiryDate, expectedExpiryDate, 'the project should have an expiry date');
        });
    });

    it('can convert a project stub into a standard legacy licence', () => {
      const title = 'Digitised Paper Licence Stub';
      const licenceNumber = 'XXX-123-XXX';
      const issueDate = new Date('2018-08-15 12:00:00').toISOString();
      const initialExpiryDate = new Date('2023-08-15 12:00:00').toISOString();
      const draftDate = new Date('2020-02-28 12:00:00').toISOString();

      const conversionTitle = 'Digitised Paper Licence';
      const expectedExpiryDate = new Date('2023-02-15 12:00:00').toISOString();
      const expectedRaDate = moment(expectedExpiryDate).add(6, 'months').toISOString();

      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            title,
            establishmentId,
            licenceHolderId: profileId,
            licenceNumber,
            issueDate,
            expiryDate: initialExpiryDate,
            isLegacyStub: true,
            schemaVersion: 0,
            status: 'active'
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId,
            data: {
              title,
              duration: {
                years: 5,
                months: 0
              },
              isLegacyStub: true,
              retrospectiveAssessment: true
            },
            status: 'granted',
            asruVersion: true,
            createdAt: issueDate
          },
          {
            id: '0e13dc10-86a2-4ace-acda-06da54e6e8eb',
            projectId,
            data: {
              title: conversionTitle,
              duration: {
                years: 4,
                months: 6
              },
              isLegacyStub: true,
              retrospectiveAssessment: true
            },
            status: 'draft',
            asruVersion: true,
            createdAt: draftDate
          }
        ]))
        .then(() => {
          const opts = {
            action: 'convert',
            id: projectId,
            data: {
              establishmentId
            },
            meta: {
              version: '0e13dc10-86a2-4ace-acda-06da54e6e8eb'
            }
          };

          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.query().findById(projectId).eager('version'))
            .then(project => {
              assert.equal(project.status, 'active', 'the project should still be active');
              assert.equal(project.title, conversionTitle, 'the project title should reflect the converted version');
              assert.equal(project.expiryDate, expectedExpiryDate, 'the expiry date should reflect the converted version duration');
              assert.equal(project.raDate, expectedRaDate, 'the retrospective assessment date should be set and 6 months from expiry');
              assert.equal(project.isLegacyStub, false, 'the project should not be a legacy stub');
              assert.equal(project.version.length, 2, 'there should be exactly 2 versions');

              const convertedVersion = project.version.find(v => v.id === '0e13dc10-86a2-4ace-acda-06da54e6e8eb');

              assert.equal(convertedVersion.isLegacyStub, undefined, 'the converted version should not be a legacy stub');
              assert.equal(convertedVersion.status, 'granted', 'the converted version should be granted');
              assert.equal(convertedVersion.data.title, conversionTitle, 'thet title should match the converted version');
            });
        });
    });

    it('can delete a project stub', () => {
      const title = 'Digitised Paper Licence Stub';
      const issueDate = new Date('2018-08-15 12:00:00').toISOString();
      const expiryDate = new Date('2023-08-15 12:00:00').toISOString();

      return Promise.resolve()
        .then(() => this.models.Project.query().insert([
          {
            id: projectId,
            title,
            establishmentId,
            licenceHolderId: profileId,
            licenceNumber: 'XXX-123-XXX',
            issueDate,
            expiryDate,
            isLegacyStub: true,
            schemaVersion: 0,
            status: 'active'
          }
        ]))
        .then(() => this.models.ProjectVersion.query().insert([
          {
            id: '574266e5-ef34-4e34-bf75-7b6201357e75',
            projectId,
            data: {
              title,
              duration: {
                years: 5,
                months: 0
              },
              isLegacyStub: true
            },
            status: 'granted',
            asruVersion: true,
            createdAt: issueDate
          }
        ]))
        .then(() => {
          const opts = {
            action: 'delete',
            id: projectId
          };

          return Promise.resolve()
            .then(() => this.project(opts))
            .then(() => this.models.Project.queryWithDeleted().findById(projectId).eager('version'))
            .then(project => {
              assert(project.deleted, 'the project should be deleted');
              assert(moment(project.deleted).isValid(), 'the project deleted date should be valid');
              project.version.map(version => {
                assert(version.deleted, 'the version should be deleted');
                assert(moment(version.deleted).isValid(), 'the version deleted date should be valid');
              });
            });
        });
    });

  });

});
