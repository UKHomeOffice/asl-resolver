const { v4: uuid } = require('uuid');
const assert = require('assert');
const db = require('../helpers/db');
const resolver = require('../../lib/resolvers/project-profile');

const ids = {
  projectId: uuid(),
  licenceHolderId: uuid(),
  userToInvite: uuid()
};

describe('ProjectProfile resolver', () => {
  let models;
  let knexInstance;
  let transaction;

  before(async () => {
    models = await db.init();
    knexInstance = await db.getKnex();
    this.resolver = resolver({ models });
  });

  beforeEach(async () => {
    await db.clean(models);

    await models.Establishment.query(knexInstance).insertGraph({
      name: 'Univerty of Croydon',
      profiles: [
        {
          id: ids.licenceHolderId,
          firstName: 'Licence',
          lastName: 'Holder',
          email: 'licence-holder@example.com'
        },
        {
          id: ids.userToInvite,
          firstName: 'Basic',
          lastName: 'User',
          email: 'basic-user@example.com'
        }
      ],
      projects: [
        {
          id: ids.projectId,
          licenceHolderId: ids.licenceHolderId,
          status: 'inactive',
          schemaVersion: 1
        }
      ]
    });
  });

  after(async () => {
    await knexInstance.destroy();
  });

  it('can invite a user to the project', async () => {
    const params = {
      model: 'projectProfile',
      action: 'create',
      data: {
        profileId: ids.userToInvite,
        projectId: ids.projectId
      }
    };

    transaction = await knexInstance.transaction();
    await this.resolver(params, transaction);
    transaction.commit();

    const project = await models.Project.query(knexInstance).findById(ids.projectId).withGraphFetched('collaborators');
    assert.equal(project.collaborators.length, 1);
    assert.equal(project.collaborators[0].firstName, 'Basic', 'it should add the profile to the project');
  });

  it('can remove a user from the project', async () => {
    const params = {
      model: 'projectProfile',
      action: 'delete',
      data: {
        profileId: ids.userToInvite,
        projectId: ids.projectId
      }
    };

    await models.ProjectProfile.query(knexInstance).insert({ projectId: ids.projectId, profileId: ids.userToInvite });

    transaction = await knexInstance.transaction();
    await this.resolver(params, transaction);
    transaction.commit();

    const project = await models.Project.query(knexInstance).findById(ids.projectId).withGraphFetched('collaborators');
    assert.equal(project.collaborators.length, 0, 'user was removed from project');
  });

});
