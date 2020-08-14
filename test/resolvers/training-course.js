const assert = require('assert');
const { trainingCourse } = require('../../lib/resolvers');
const db = require('../helpers/db');
const uuid = require('uuid/v4');

const establishment = {
  id: 8201,
  name: 'University of Croydon'
};

const profile = {
  id: uuid(),
  firstName: 'Bruce',
  lastName: 'Banner',
  email: 'holcymcholcface@example.com'
};

const project = {
  id: uuid(),
  establishmentId: 8201,
  licenceHolderId: profile.id,
  status: 'active',
  title: 'Test project'
};

describe('Training course resolver', () => {
  before(() => {
    this.models = db.init();
    this.trainingCourse = trainingCourse({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insert(establishment))
      .then(() => this.models.Profile.query().insert(profile))
      .then(() => this.models.Project.query().insert(project));
  });

  afterEach(() => {
    return db.clean(this.models);
  });

  after(() => {
    return this.models.destroy();
  });

  it('rejects with an error if action unknown', () => {
    return assert.rejects(() => {
      return this.trainingCourse({ action: 'doSomething', data: {} });
    }, {
      name: 'Error',
      message: /Unknown action: doSomething/
    });
  });

  describe('Create', () => {
    it('can insert a trainingCourse model', () => {
      const opts = {
        action: 'create',
        data: {
          establishmentId: 8201,
          projectId: project.id,
          startDate: '2020-11-01',
          title: 'Test course',
          species: ['mice']
        }
      };
      return Promise.resolve()
        .then(() => this.trainingCourse(opts))
        .then(() => this.models.TrainingCourse.query().findOne({ projectId: project.id }))
        .then(course => {
          assert.ok(course);
          assert.deepEqual(course.startDate, opts.data.startDate);
          assert.deepEqual(course.title, opts.data.title);
          assert.deepEqual(course.species, opts.data.species);
        });
    });

  });
});
