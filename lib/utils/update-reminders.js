async function updateReminders(id, reminder, Reminder, transaction) {
  if (reminder) {
    await Reminder.upsert({
      ...reminder,
      modelType: 'establishment',
      establishmentId: id,
      status: 'active',
      deleted: reminder.deleted ? new Date().toISOString() : undefined
    }, undefined, transaction);
  }
}

module.exports = updateReminders;
