const assert = require('assert');
const moment = require('moment');

const calculateExpiryDate = require('../../lib/helpers/calculate-expiry-date.js');

describe('calculateExpiryDate', () => {

    it('should expire license in 1 year after issue date', () => {
        const result = calculateExpiryDate(new Date('2014-07-26').toISOString(), moment.duration(1, 'year'));
        assert.equal(result, '2015-07-25T23:59:59.999+01:00');
    });

    it('should expire license in 2 days from given date', () => {
        const result = calculateExpiryDate(undefined, moment.duration(2, 'day'));
        assert.equal(result, '2024-07-30T23:59:59.999+01:00');
    });

    it('should expire license in 1 year from given date', () => {
        const result = calculateExpiryDate(new Date().toISOString(), moment.duration(1, 'year'));
        assert.equal(result, '2025-07-28T23:59:59.999+01:00');
    });

    it('should get correct expiry when issue data is a date string', () => {
        const result = calculateExpiryDate(new Date('2018-01-01').toISOString(), moment.duration(2, 'years'));
        assert.equal(result, '2019-12-31T23:59:59.999+00:00');
    });
});
