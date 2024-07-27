/* eslint-disable no-only-tests/no-only-tests */
const assert = require('assert');
const moment = require('moment');
const sinon = require('sinon');

const calculateExpiryDate = require('../../lib/helpers/calculate-expiry-date.js');

describe('calculateExpiryDate', () => {

    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers(new Date('2024-01-01'));
    });

    afterEach(() => {
        clock.restore();
    });

    it('should expire license in 1 year after issue date', () => {
        const result = calculateExpiryDate(moment('26-07-2014', 'DD-MM-YYYY').toISOString(), moment.duration(1, 'year'));
        assert.equal(result, '2015-07-25T23:59:59.999+01:00');
    });

    it('should expire license in 2 days from given date', () => {
        const result = calculateExpiryDate(undefined, moment.duration(2, 'day'));
        assert.equal(result, '2024-01-02T23:59:59.999+00:00');
    });

    it('should expire license in 1 year from given date', () => {
        const now = moment();
        const result = calculateExpiryDate(now, moment.duration(1, 'year'));
        assert.equal(result, '2024-12-31T23:59:59.999+00:00');
    });

    it('should get correct expiry when issue data is a date string', () => {
        const result = calculateExpiryDate(new Date('2018-08-15').toISOString(), moment.duration(2, 'years'));
        assert.equal(result, '2020-08-14T23:59:59.999+01:00');
    });
});
