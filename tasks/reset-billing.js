function deleteAnnuallyUpdatedFields(Model, knex) {
  return Model.query()
    .patch({ billing: knex.raw("billing - '{purchaseOrder,otherInformation,declaredCurrent}'::text[]") })
    .whereNotNull('billing')
    .returning('id');
}

const resetBilling = async ({ models, logger }) => {
  const { Establishment, knex } = models;

  logger.info(`Clearing purchaseOrder, otherInformation, declaredCurrent from establishments' billing information`);

  const ids = await deleteAnnuallyUpdatedFields(Establishment, knex);

  return logger.info(`Cleared annual billing information for ${ids.length} establishments`);
};

module.exports = resetBilling;
