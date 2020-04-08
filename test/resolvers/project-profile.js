const uuid = require('uuid/v4');
const assert = require('assert');
const db = require('../helpers/db');
const resolver = require('../../lib/resolvers/project-profile');

const ids = {
  projectId: uuid(),
  licenceHolderId: uuid(),
  userToInvite: uuid()
};

describe('ProjectProfile resolver', () => {
  before(() => {
    this.models = db.init();
    this.resolver = resolver({ models: this.models });
  });

  beforeEach(() => {
    return db.clean(this.models)
      .then(() => this.models.Establishment.query().insertGraph({
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
      }));
  });

  after(() => {
    return this.models.destroy();
  });

  it('can invite a user to the project', () => {
    const params = {
      model: 'projectProfile',
      action: 'create',
      data: {
        profileId: ids.userToInvite,
        projectId: ids.projectId
      }
    };

    return Promise.resolve()
      .then(() => this.resolver(params))
      .then(() => {
        return this.models.Project.query().findById(ids.projectId).withGraphFetched('collaborators');
      })
      .then(project => {
        assert.equal(project.collaborators.length, 1);
        assert.equal(project.collaborators[0].firstName, 'Basic', 'it should add the profile to the project');
      });
  });

  it('can remove a user from the project', () => {
    const params = {
      model: 'projectProfile',
      action: 'delete',
      data: {
        profileId: ids.userToInvite,
        projectId: ids.projectId
      }
    };

    return Promise.resolve()
      .then(() => this.models.ProjectProfile.query().insert({ projectId: ids.projectId, profileId: ids.userToInvite }))
      .then(() => this.resolver(params))
      .then(() => this.models.Project.query().findById(ids.projectId).withGraphFetched('collaborators'))
      .then(project => {
        assert.equal(project.collaborators.length, 0, 'user was removed from project');
      });
  });

});
