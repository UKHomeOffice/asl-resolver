const moment = require('moment');
const assert = require('assert');
const { trainingPil } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

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
    profileId: ids.profile.existing
  }
];

describe('Training pil resolver', () => {
  before(() => {
    this.models = db.init();
    this.trainingPil = trainingPil({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert(establishment))
      .then(() => this.models.Profile.query().insert(profiles))
      .then(() => this.models.Project.query().insert(project))
      .then(() => this.models.TrainingCourse.query().insert(trainingCourse))
      .then(() => this.models.TrainingPil.query().insert(trainingPils));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  describe('create', () => {
    it('creates a new profile if not found', () => {
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

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.Profile.query().findOne({ email: opts.data.email }))
        .then(profile => {
          assert.equal(profile.firstName, opts.data.firstName);
          assert.equal(profile.lastName, opts.data.lastName);
          assert.equal(profile.email, opts.data.email);
          assert.equal(profile.dob, opts.data.dob);
        });
    });

    it('creates a new inactive training pil model', () => {
      const opts = {
        action: 'create',
        data: {
          firstName: 'Bruce',
          lastName: 'Banner',
          email: 'holcymcholcface@example.com',
          trainingCourseId: ids.trainingCourse
        }
      };

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.TrainingPil.query().findOne({ profileId: ids.profile.bruce, trainingCourseId: ids.trainingCourse }))
        .then(trainingPil => {
          assert.ok(trainingPil);
          assert.equal(trainingPil.status, 'inactive');
        });
    });

    it('updates the profile DOB if not set', () => {
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

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.Profile.query().findById(ids.profile.bruce))
        .then(profile => {
          assert.equal(profile.dob, opts.data.dob);
        });
    });

    it('returns an existing trainingPil if already exists', () => {
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

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(trainingPil => {
          return Promise.resolve()
            .then(() => this.models.TrainingPil.query().findById(ids.trainingPil))
            .then(returnedTrainingPil => {
              assert.equal(trainingPil.id, returnedTrainingPil.id);
            });
        });
    });
  });

  describe('grant', () => {
    it('can grant an existing trainingPil', () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.TrainingPil.query().findById(ids.trainingPil))
        .then(trainingPil => {
          assert.equal(trainingPil.status, 'active');
          assert.ok(isNowish(trainingPil.issueDate));
          assert.ok(isNowish(moment(trainingPil.expiryDate).subtract(3, 'months')));
        });
    });

    it('adds a pilLicenceNumber to the profile if missing', () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.Profile.query().findById(ids.profile.existing))
        .then(profile => {
          assert.ok(profile.pilLicenceNumber);
        });
    });

    it('associates the user with the establishment if not already', () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };

      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.models.Permission.query().findOne({ profileId: ids.profile.existing, establishmentId: ids.establishment }))
        .then(permission => {
          assert.ok(permission);
          assert.equal(permission.role, 'basic');
        });
    });
  });

  describe('revoke', () => {
    it('can revoke an active trainingPil', () => {
      const opts = {
        action: 'grant',
        id: ids.trainingPil
      };
      return Promise.resolve()
        .then(() => this.trainingPil(opts))
        .then(() => this.trainingPil({ ...opts, action: 'revoke' }))
        .then(() => this.models.TrainingPil.query().findById(ids.trainingPil))
        .then(trainingPil => {
          assert.equal(trainingPil.status, 'revoked');
          assert.ok(isNowish(trainingPil.revocationDate));
        });
    });
  });
});
