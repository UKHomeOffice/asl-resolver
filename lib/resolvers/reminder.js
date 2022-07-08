
module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { Reminder, ReminderDismissed } = models;

  if (action === 'dismiss') {
    const profileId = data.profileId;
    const dismissed = await ReminderDismissed.query(transaction).where({ reminderId: id, profileId }).first();

    if (!dismissed) {
      await ReminderDismissed.query(transaction).insert({ reminderId: id, profileId });
    }

    return Reminder.query(transaction).findById(id).withGraphFetched('dismissed');
  }

  return Promise.reject(new Error(`Unknown action: ${action}`));
};
