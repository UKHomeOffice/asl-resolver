const assert = require('assert');
const db = require('../helpers/db');
const resetBilling = require('../../tasks/reset-billing');
const Logger = require('../../lib/utils/logger');

const UNI_WITH_BILLING_1 = {
  id: 8201,
  name: 'University of Croydon',
  billing: {
    contactName: 'Name',
    contactNumber: '01234 567890',
    contactEmail: 'billing@example.org',
    contactAddress: '123 A Street,\nLondon,\nSW1A 1AA',
    hasPurchaseOrder: 'yes',
    purchaseOrder: '123-456789-0',
    otherInformation: 'Other billing info',
    declaredCurrent: true
  }
};

const UNI_WITH_BILLING_2 = {
  id: 8202,
  name: 'College of Croydon',
  billing: {
    contactName: 'Another Name',
    contactNumber: '01234 567890',
    contactEmail: 'billing@example.com',
    contactAddress: '123 Another Street,\nLondon,\nSW1A 1AA',
    hasPurchaseOrder: 'no',
    alternativePaymentMethod: 'Payment sent on receipt of invoice by email.',
    otherInformation: ''
  }
};

const UNI_WITHOUT_BILLING = {
  id: 8203,
  name: 'College of Croydon',
  billing: null
};

function assertAnnualFieldsRemoved(actual, original) {
  assert.equal(actual.billing.contactName, original.billing.contactName);
  assert.equal(actual.billing.contactNumber, original.billing.contactNumber);
  assert.equal(actual.billing.contactEmail, original.billing.contactEmail);
  assert.equal(actual.billing.contactAddress, original.billing.contactAddress);
  assert.equal(actual.billing.purchaseOrder, undefined);
  assert.equal(actual.billing.hasPurchaseOrder, undefined);
  assert.equal(actual.billing.alternativePaymentMethod, undefined);
  assert.equal(actual.billing.otherInformation, undefined);
  assert.equal(actual.billing.declaredCurrent, undefined);

}

describe('Annual reset of billing', () => {

  before(() => {
    this.models = db.init();
  });

  after(() => this.models.destroy());

  it('should reset billing information for all establishments', async () => {
    await db.clean(this.models);
    await Promise.all([
      this.models.Establishment.query().insert(UNI_WITH_BILLING_1),
      this.models.Establishment.query().insert(UNI_WITH_BILLING_2),
      this.models.Establishment.query().insert(UNI_WITHOUT_BILLING)
    ]);

    await resetBilling({ models: this.models, logger: Logger({logLevel: 'silent'}) });

    const [withBilling1] = await this.models.Establishment.query().where('id', UNI_WITH_BILLING_1.id);
    const [withBilling2] = await this.models.Establishment.query().where('id', UNI_WITH_BILLING_2.id);
    const [withoutBilling] = await this.models.Establishment.query().where('id', UNI_WITHOUT_BILLING.id);

    console.log(withBilling1);

    assertAnnualFieldsRemoved(withBilling1, UNI_WITH_BILLING_1);
    assertAnnualFieldsRemoved(withBilling2, UNI_WITH_BILLING_2);
    assert.equal(withoutBilling.billing, null);
  });
});
