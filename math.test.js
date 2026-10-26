const test = require('node:test');
const assert = require('node:assert');
const { add } = require('./math');

test('adds two numbers', () => {
  assert.strictEqual(add(2, 3), 5);
});
