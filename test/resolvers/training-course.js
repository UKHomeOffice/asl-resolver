const assert = require('assert');
const { trainingCourse } = require('../../lib/resolvers');
const db = require('../helpers/db');
const { v4: uuid } = require('uuid');

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
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.trainingCourse = trainingCourse({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insert(establishment);
    await models.Profile.query(knexInstance).insert(profile);
    await models.Project.query(knexInstance).insert(project);
  });

  afterEach(async () => {
    return db.clean(models);
  });

  after(async () => {
    await knexInstance.destroy();
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
    it('can insert a trainingCourse model', async () => {
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

      transaction = await knexInstance.transaction();
      await this.trainingCourse(opts, transaction);
      transaction.commit();

      const course = await models.TrainingCourse.query(knexInstance).findOne({ projectId: project.id });
      assert.ok(course);
      assert.deepEqual(course.startDate, opts.data.startDate);
      assert.deepEqual(course.title, opts.data.title);
      assert.deepEqual(course.species, opts.data.species);
    });

  });
});
