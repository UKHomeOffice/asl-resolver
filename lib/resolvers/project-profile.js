module.exports = ({ models }) => ({ action, data }, transaction) => {
  const { ProjectProfile } = models;
  const { projectId, profileId } = data;

  if (action === 'create') {
    return ProjectProfile.query(transaction)
      .findOne({ projectId, profileId })
      .then(existing => {
        if (existing) {
          return existing;
        }
        return ProjectProfile.query(transaction)
          .insert({ projectId, profileId })
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
