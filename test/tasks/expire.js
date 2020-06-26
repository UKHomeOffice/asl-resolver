const assert = require('assert');
const moment = require('moment');
const db = require('../helpers/db');
const expireTask = require('../../tasks/expire');
const Logger = require('../../lib/utils/logger');

const establishmentId = 8201;
const profileId = 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9';

describe('Project expiry', () => {
  before(() => {
    this.models = db.init();
    this.expire = () => {
      return expireTask({ models: this.models, logger: Logger({ logLevel: 'silent' }) });
    };
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert({
        id: establishmentId,
        name: 'Univerty of Croydon'
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
      .then(() => this.models.Project.query().insert([
        {
          title: 'Active project with expiry 1 month ago (should expire)',
          status: 'active',
          expiryDate: moment().subtract(1, 'month').toISOString(),
          licenceNumber: 'active-expires-minus-1-month',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Active project with expiry 1 week ago (should expire)',
          status: 'active',
          expiryDate: moment().subtract(1, 'week').toISOString(),
          licenceNumber: 'active-epires-minus-1-week',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Active project with expiry 1 day ago (should expire)',
          status: 'active',
          expiryDate: moment().subtract(1, 'day').toISOString(),
          licenceNumber: 'active-expires-minus-1-day',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Active project with expiry 1 second before midnight last night (should expire)',
          status: 'active',
          expiryDate: moment().subtract(1, 'day').endOf('day').toISOString(),
          licenceNumber: 'active-expires-minus-1-second',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Active project with expiry today (should not expire)',
          status: 'active',
          expiryDate: moment().toISOString(),
          licenceNumber: 'active-expires-today',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Active project with expiry next week (should not expire)',
          status: 'active',
          expiryDate: moment().add(1, 'week').toISOString(),
          licenceNumber: 'active-expires-plus-1-week',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Draft project with null expiry date (should not expire)',
          status: 'inactive',
          expiryDate: null,
          licenceNumber: 'inactive-expires-null',
          establishmentId,
          licenceHolderId: profileId
        },
        {
          title: 'Revoked project with expiry 1 month ago (should not expire)',
          status: 'revoked',
          expiryDate: moment().subtract(1, 'month').toISOString(),
          licenceNumber: 'revoked-expires-minus-1-month',
          establishmentId,
          licenceHolderId: profileId
        }
      ]));
  });

  afterEach(() => db.clean(this.models));

  after(() => this.models.destroy());

  it('expires active projects with an expiry date before midnight of last night', () => {
    return this.expire()
      .then(() => {
        this.models.Project.query().where('title', 'like', '%(should expire)%')
          .then(projects => {
            projects.map(project => {
              assert.equal(project.status, 'expired', 'project status should be expired');
            });
          });
      });
  });

  it('does not expire projects expiring today', () => {
    return this.expire()
      .then(() => {
        this.models.Project.query().findOne({ licenceNumber: 'active-expires-today' })
          .then(project => {
            assert.notEqual(project.status, 'expired', 'project status should not be expired');
          });
      });
  });

  it('does not expire projects expiring in the future', () => {
    return this.expire()
      .then(() => {
        this.models.Project.query().findOne({ licenceNumber: 'active-expires-plus-1-week' })
          .then(project => {
            assert.notEqual(project.status, 'expired', 'project status should not be expired');
          });
      });
  });

  it('does not expire inactive (draft) projects', () => {
    return this.expire()
      .then(() => {
        this.models.Project.query().findOne({ licenceNumber: 'inactive-expires-null' })
          .then(project => {
            assert.notEqual(project.status, 'expired', 'project status should not be expired');
          });
      });
  });

  it('does not expire revoked projects even if expiry is in the past', () => {
    return this.expire()
      .then(() => {
        this.models.Project.query().findOne({ licenceNumber: 'revoked-expires-minus-1-month' })
          .then(project => {
            assert.notEqual(project.status, 'expired', 'project status should not be expired');
          });
      });
  });
});
