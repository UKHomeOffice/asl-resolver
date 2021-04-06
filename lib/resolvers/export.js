module.exports = ({ models }) => ({ action, data }, transaction) => {
  if (action === 'create') {
    return models.Export.query(transaction).insert(data);
  }
  return Promise.reject(new Error(`Unknown action: ${action}`));
};
