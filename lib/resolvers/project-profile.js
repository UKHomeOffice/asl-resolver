module.exports = ({ models }) => ({ action, data }, transaction) => {
  const { ProjectProfile } = models;
  const { projectId, profileId, role } = data;

  if (action === 'create') {
    return ProjectProfile.query(transaction)
      .findOne({ projectId, profileId })
      .then(existing => {
        if (existing) {
          return existing;
        }
        return ProjectProfile.query(transaction)
          .insert({ projectId, profileId, role })
          .returning('*');
      });
  }

  if (action === 'update') {
    return ProjectProfile.query(transaction)
      .findOne({ projectId, profileId })
      .then(collaborator => {
        return collaborator.$query(transaction)
          .patch({ role })
          .returning('*');
      });
  }

  if (action === 'delete') {
    return ProjectProfile.query(transaction)
      .hardDelete()
      .where({ profileId, projectId })
      .returning('*');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
