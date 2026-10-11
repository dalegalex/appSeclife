const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function checkVersions(expected, sources) {
  for (const [file, versions] of Object.entries(sources)) {
    if (!versions.length || versions.some((version) => version !== expected)) {
      throw new Error(`Version mismatch in ${file}: expected ${expected}, found ${versions.join(', ') || 'missing'}`);
    }
  }
}

function environmentVersions(file) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const versions = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'appVersion'
      && ts.isStringLiteral(node.initializer)) versions.push(node.initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return versions;
}

if (require.main === module) {
  const expected = JSON.parse(read('package.json')).version;
  const lock = JSON.parse(read('package-lock.json'));
  checkVersions(expected, {
    'package-lock.json': [lock.version, lock.packages[''].version],
    'environment.ts': environmentVersions('src/environments/environment.ts'),
    'environment.prod.ts': environmentVersions('src/environments/environment.prod.ts'),
    'android/app/build.gradle': [...read('android/app/build.gradle').matchAll(/versionName\s+["']([^"']+)["']/g)].map((match) => match[1]),
    'ios/project.pbxproj': [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/MARKETING_VERSION\s*=\s*([^;\s]+);/g)].map((match) => match[1]),
  });
  console.log(`Release version consistent: ${expected}`);
}

module.exports = { checkVersions };
