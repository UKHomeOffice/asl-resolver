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
        const result = calculateExpiryDate(new Date('2014-07-26'), moment.duration(1, 'year'));
        assert.equal(new Date(result).toISOString().split('T')[0], '2015-07-25');
    });

    it('should expire license in 2 days from given date', () => {
        const result = calculateExpiryDate(undefined, moment.duration(2, 'day'));
        assert.equal(result, '2024-01-02T23:59:59.999Z');
    });

    it('should expire license in 1 year from given date', () => {
        const result = calculateExpiryDate(new Date().toISOString(), moment.duration(1, 'year'));
        assert.equal(result, '2024-12-31T23:59:59.999Z');
    });

    it('should expire license in 1 month from given date', () => {
        const result = calculateExpiryDate(new Date().toISOString(), { months: 1 });
        assert.equal(result, '2024-01-31T23:59:59.999Z');
    });

    it('should get correct expiry when issue data is a date string', () => {
        const result = calculateExpiryDate(new Date('2018-01-01').toISOString(), moment.duration(2, 'years'));
        assert.equal(result, '2019-12-31T23:59:59.999Z');
    });

    it('should get default expiry when issue data and duration are undefined', () => {
        const result = calculateExpiryDate(undefined, undefined);
        assert.equal(result, '2028-12-31T23:59:59.999Z');
    });
});
