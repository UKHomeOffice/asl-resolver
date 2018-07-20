module.exports = ({ models, keycloak }, { action, data, id }) => {
  const { Profile } = models;

  if (action === 'create') {
    return keycloak.createUser(data.email);
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
