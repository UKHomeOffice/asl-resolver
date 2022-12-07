async function updateConditions(id, condition, reminder, Reminder, Establishment, transaction) {
  if (reminder) {
    await Reminder.upsert({
      ...reminder,
      modelType: 'establishment',
      establishmentId: id,
      status: 'active',
      deleted: reminder.deleted ? new Date().toISOString() : undefined
    }, undefined, transaction);
  }

  return Establishment.query(transaction)
    .findById(id)
    .patch({ updatedAt: new Date().toISOString(), conditions: condition });
}

module.exports = updateConditions;
