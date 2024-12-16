const moment = require('moment');
const assert = require('assert');
const { trainingPil } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

function isNowish(date) {
  return moment(date).isBetween(moment().subtract(5, 'seconds'), moment().add(5, 'seconds'));
}

const ids = {
  establishment: 8201,
  profile: {
    bruce: uuid(),
    existing: uuid()
  },
  project: uuid(),
  trainingCourse: uuid(),
  trainingPil: uuid()
};

const establishment = {
  id: ids.establishment,
  name: 'University of Croydon'
};

const profiles = [
  {
    id: ids.profile.bruce,
    firstName: 'Bruce',
    lastName: 'Banner',
    email: 'holcymcholcface@example.com'
  },
  {
    id: ids.profile.existing,
    firstName: 'Existing',
    lastName: 'Pil',
    email: 'existing@pil.com'
  }
];

const project = {
  id: ids.project,
  establishmentId: 8201,
  licenceHolderId: ids.profile.bruce,
  status: 'active',
  title: 'Test project'
};

const trainingCourse = {
  id: ids.trainingCourse,
  establishmentId: ids.establishment,
  projectId: ids.project,
  title: 'Test training course',
  startDate: moment().add(1, 'month').format('YYYY-MM-DD')
};

const trainingPils = [
  {
    id: ids.trainingPil,
    trainingCourseId: ids.trainingCourse,
    profileId: ids.profile.existing,
    organisation: 'university of croydon',
    qualificationLevelAndSubject: 'bsc',
    applicantLearningUse: 'to learn a new surgical procedure',
    jobTitleOrQualification: 'researcher',
    fieldOfExpertise: 'surgery',
    applicantTrainingUseAtWork: 'yes',
    otherNotes: 'some notes'
  }
];

describe('Training pil resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.trainingPil = trainingPil({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert(establishment);
    await models.Profile.query(knexInstance).insert(profiles);
    await models.Project.query(knexInstance).insert(project);
    await models.TrainingCourse.query(knexInstance).insert(trainingCourse);
    await models.TrainingPil.query(knexInstance).insert(trainingPils);
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
  });

  describe('create', () => {
    it('creates a new profile if not found', async () => {
      const opts = {
        action: 'create',
        data: {
          firstName: 'Sterling',
          lastName: 'Archer',
          email: 'sterling@archer.com',
          dob: '1970-12-12',
          trainingCourseId: ids.trainingCourse
        }
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findOne({ email: opts.data.email });
      assert.equal(profile.firstName, opts.data.firstName);
      assert.equal(profile.lastName, opts.data.lastName);
      assert.equal(profile.email, opts.data.email);
      assert.equal(profile.dob, opts.data.dob);
    });

    it('creates a new inactive training pil model', async () => {
      const opts = {
        action: 'create',
        data: {
          firstName: 'Bruce',
          lastName: 'Banner',
          email: 'holcymcholcface@example.com',
          trainingCourseId: ids.trainingCourse
        }
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const trainingPil = await models.TrainingPil.query(knexInstance).findOne({ profileId: ids.profile.bruce, trainingCourseId: ids.trainingCourse });
      assert.ok(trainingPil);
      assert.equal(trainingPil.status, 'inactive');
    });

    it('updates the profile DOB if not set', async () => {
      const opts = {
        action: 'create',
        data: {
          firstName: 'Bruce',
          lastName: 'Banner',
          email: 'holcymcholcface@example.com',
          dob: '1970-12-12',
          trainingCourseId: ids.trainingCourse
        }
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ids.profile.bruce);
      assert.equal(profile.dob, opts.data.dob);
    });

    it('returns an existing trainingPil if already exists', async () => {
      const opts = {
        action: 'create',
        data: {
          firstName: 'Existing',
          lastName: 'Pil',
          email: 'existing@pil.com',
          dob: '1970-12-12',
          trainingCourseId: ids.trainingCourse
        }
      };

      transaction = await knexInstance.transaction();
      const trainingPil = await this.trainingPil(opts, transaction);
      transaction.commit();

      const returnedTrainingPil = await models.TrainingPil.query(knexInstance).findById(ids.trainingPil);
      assert.equal(trainingPil.id, returnedTrainingPil.id);
    });
  });

  describe('grant', () => {
    it('can grant an existing trainingPil', async () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const trainingPil = await models.TrainingPil.query(knexInstance).findById(ids.trainingPil);
      assert.equal(trainingPil.status, 'active');
      assert.ok(isNowish(trainingPil.issueDate));
      assert.ok(isNowish(moment(trainingPil.expiryDate).subtract(3, 'months')));
    });

    it('adds a pilLicenceNumber to the profile if missing', async () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const profile = await models.Profile.query(knexInstance).findById(ids.profile.existing);
      assert.ok(profile.pilLicenceNumber);
    });

    it('associates the user with the establishment if not already', async () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      const permission = await models.Permission.query(knexInstance).findOne({ profileId: ids.profile.existing, establishmentId: ids.establishment });
      assert.ok(permission);
      assert.equal(permission.role, 'basic');
    });
  });

  describe('revoke', () => {
    it('can revoke an active trainingPil', async () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      transaction = await knexInstance.transaction();
      await this.trainingPil(opts, transaction);
      transaction.commit();

      transaction = await knexInstance.transaction();
      await this.trainingPil({ ...opts, action: 'revoke' }, transaction);
      transaction.commit();

      const trainingPil = await models.TrainingPil.query(knexInstance).findById(ids.trainingPil);
      assert.equal(trainingPil.status, 'revoked');
      assert.ok(isNowish(trainingPil.revocationDate));
    });
  });
});
