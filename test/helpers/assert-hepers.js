const assert = require('assert');
module.exports = {
  /**
   *
   * @param {array} actual
   * @param {array} expected
   * @param {string | undefined} message
   */
  assertIncludesInAnyOrder(actual, expected, message = undefined) {
    const messagePrefix = message ? `${message}: ` : '';

    expected.forEach(entry => assert.ok(actual.includes(entry), `${messagePrefix}'${entry}' not present`));
    assert.equal(actual.length, expected.length, `${messagePrefix}Lengths do not match`);
  }
};
