const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, 'sync-boleta-renderer.cjs'), 'utf8');
function check(source, bundled) {
  vm.runInNewContext(script, {
    __dirname,
    process: { argv: ['node', 'sync-boleta-renderer.cjs', '--check'] },
    console: { log() {} },
    require: name => name === 'node:path' ? path : {
      existsSync: () => source !== null,
      readFileSync: file => file.endsWith('boletas-report.generated.ts') ? bundled : source,
    },
  });
}
test('Mac can check the bundled renderer without PSeclife', () => check(null, 'export const renderer = 1;'));
test('line endings do not cause a false source mismatch', () => check('a\r\nb', 'a\nb'));
test('different portal and bundled renderer fail', () => assert.throws(() => check('a', 'b'), /differs/));
test('empty bundled renderer fails without portal', () => assert.throws(() => check(null, ''), /Missing/));
