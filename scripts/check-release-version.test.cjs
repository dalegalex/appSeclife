const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkVersions } = require('./check-release-version.cjs');

test('accepts matching versions across configurations', () => {
  assert.doesNotThrow(() => checkVersions('4.1.7', { env: ['4.1.7'], ios: ['4.1.7', '4.1.7'] }));
});
test('rejects a stale menu version', () => {
  assert.throws(() => checkVersions('4.1.7', { env: ['4.1.6'] }), /Version mismatch/);
});
test('rejects a missing version', () => {
  assert.throws(() => checkVersions('4.1.7', { env: [] }), /missing/);
});
