const uuid = require('uuid/v4');
const assert = require('assert');
const db = require('../helpers/db');
const retrospectiveAssessment = require('../../lib/resolvers/retrospective-assessment');

const projectId = uuid();
const raId = uuid();
const profileId = uuid();

describe('Retrospective assessment', () => {
  before(() => {
    this.models = db.init();
    this.retrospectiveAssessment = retrospectiveAssessment({ models: this.models });
  });

  beforeEach(() => {
    return Promise.resolve()
      .then(() => this.models.Establishment.query().insert({
        id: 8201,
        name: 'University of Croydon'
      }))
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
      }))
      .then(() => this.models.Project.query().insert({
        id: projectId,
        status: 'revoked',
        revocationDate: new Date('2020-01-01').toISOString(),
        title: 'Hypoxy and angiogenesis in cancer therapy',
        issueDate: new Date('2019-07-11').toISOString(),
        expiryDate: new Date('2022-07-11').toISOString(),
        licenceNumber: 'PP-627808',
        establishmentId: 8201,
        licenceHolderId: profileId
      }));
  });

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  describe('patch', () => {
    it('updates data on patch', () => {
      const opts = {
        action: 'patch',
        id: raId,
        data: {
          patch: {
            foo: ['bar']
          }
        }
      };

      const raVersion = {
        projectId,
        id: raId,
        status: 'draft',
        data: {
          a: 'b',
          c: 'd'
        }
      };

      return Promise.resolve()
        .then(() => this.models.RetrospectiveAssessment.query().insert(raVersion))
        .then(() => this.retrospectiveAssessment(opts))
        .then(() => this.models.RetrospectiveAssessment.query().findById(raId))
        .then(ra => {
          const expected = {
            a: 'b',
            c: 'd',
            foo: 'bar'
          };
          assert.deepEqual(ra.data, expected);
        });
    });

    it('throws if raVersion is not a draft', () => {
      const opts = {
        action: 'patch',
        id: raId,
        data: {
          patch: {
            foo: ['bar']
          }
        }
      };

      const raVersion = {
        projectId,
        id: raId,
        status: 'submitted',
        data: {
          a: 'b',
          c: 'd'
        }
      };

      return Promise.resolve()
        .then(() => this.models.RetrospectiveAssessment.query().insert(raVersion))
        .then(() => this.retrospectiveAssessment(opts))
        .catch(err => {
          assert.equal(err.message, 'Can only patch draft RA versions');
        });
    });
  });
});
