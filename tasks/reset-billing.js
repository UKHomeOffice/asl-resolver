function deleteAnnuallyUpdatedFields(Model, knex) {
  return Model.query()
    .patch({ billing: knex.raw("billing - '{hasPurchaseOrder,purchaseOrder,alternativePaymentMethod,otherInformation,declaredCurrent}'::text[]") })
    .whereNotNull('billing')
    .returning('id');
}

const resetBilling = async ({ models, logger }) => {
  const { Establishment, knex } = models;

  logger.info(`Clearing payment information fields, otherInformation, and declaredCurrent from establishments' billing information`);

  const ids = await deleteAnnuallyUpdatedFields(Establishment, knex);

  return logger.info(`Cleared annual billing information for ${ids.length} establishments`);
};

module.exports = resetBilling;
