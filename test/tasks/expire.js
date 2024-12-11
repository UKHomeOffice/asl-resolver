const assert = require('assert');
const moment = require('moment');
const db = require('../helpers/db');
const expireTask = require('../../tasks/expire');
const Logger = require('../../lib/utils/logger');

const establishmentId = 8201;
const profileId = 'f0835b01-00a0-4c7f-954c-13ed2ef7efd9';

describe('Project expiry', () => {
  let models;
  let knexInstance;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();

    this.expire = async () => {
      return expireTask({ models, logger: Logger({ logLevel: 'info' }) }, knexInstance); // switch btw silent | info
    };
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert({
        id: establishmentId,
        name: 'Univerty of Croydon'
      });

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

    await models.Project.query(knexInstance).insert([
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
      ]);
  });

  afterEach(async () => {
    await db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('expires active projects with an expiry date before midnight of last night', async () => {
      await this.expire();
      const projects = await models.Project.query(knexInstance).where('title', 'like', '%(should expire)%');

      projects.map(project => {
        assert.equal(project.status, 'expired', 'project status should be expired');
      });
  });

  it('does not expire projects expiring today', async () => {
    await this.expire();

    const project = await models.Project.query(knexInstance).findOne({ licenceNumber: 'active-expires-today' });
    assert.notEqual(project.status, 'expired', 'project status should not be expired');
  });

  it('does not expire projects expiring in the future', async () => {
    await this.expire();

    const project = await models.Project.query(knexInstance).findOne({ licenceNumber: 'active-expires-plus-1-week' });
    assert.notEqual(project.status, 'expired', 'project status should not be expired');
  });

  it('does not expire inactive (draft) projects', async () => {
    await this.expire();

    const project = await models.Project.query(knexInstance).findOne({ licenceNumber: 'inactive-expires-null' });
    assert.notEqual(project.status, 'expired', 'project status should not be expired');
  });

  it('does not expire revoked projects even if expiry is in the past', async () => {
    await this.expire();

    const project = await models.Project.query(knexInstance).findOne({ licenceNumber: 'revoked-expires-minus-1-month' });
    assert.notEqual(project.status, 'expired', 'project status should not be expired');
  });
});
