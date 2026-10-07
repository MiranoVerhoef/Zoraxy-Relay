const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const intro = JSON.parse(fs.readFileSync('.introspect', 'utf8'));
const store = JSON.parse(fs.readFileSync('directories/index2.json', 'utf8'));
const repo = 'https://github.com/MiranoVerhoef/Zoraxy-Relay';
const version = `${intro.version_major}.${intro.version_minor}.${intro.version_patch}`;
const tag = `v${version}`;
const downloadBase = `${repo}/releases/latest/download`;
assert.equal(intro.id, 'com.miranoverhoef.zoraxy-relay');
assert.equal(intro.name, 'Zoraxy Relay');
assert.equal(intro.url, repo);
assert.equal(store.length, 1, 'Only the canonical plugin belongs in the index');
const entry = store[0];
for (const key of Object.keys(intro)) {
  assert.deepEqual(entry.PluginIntroSpect[key], intro[key], `Store metadata: ${key}`);
}
assert.equal(entry.IconPath, `https://raw.githubusercontent.com/MiranoVerhoef/Zoraxy-Relay/refs/heads/main/icon.png?v=${version}`);
assert.equal(fs.readFileSync('.releaseurl', 'utf8').trim(), downloadBase);
assert.match(fs.readFileSync('go.mod', 'utf8'), /^module github\.com\/MiranoVerhoef\/Zoraxy-Relay\r?\n/);

const targets = ['linux_amd64', 'linux_arm64', 'linux_arm', 'darwin_amd64', 'darwin_arm64', 'windows_amd64', 'windows_arm64'];
assert.deepEqual(Object.keys(entry.DownloadURLs).sort(), [...targets].sort());
for (const target of targets) {
  const suffix = target.startsWith('windows_') ? '.exe' : '';
  assert.equal(entry.DownloadURLs[target], `${downloadBase}/zoraxy-relay_${target}${suffix}`);
  if (process.argv[4]) {
    for (const binary of ['zoraxy-relay', 'zoraxy-relay-client']) {
      assert.ok(fs.statSync(path.join(process.argv[4], `${binary}_${target}${suffix}`)).size > 0);
    }
  }
}
if (process.argv[2]) {
  const runtime = JSON.parse(execFileSync(path.resolve(process.argv[2]), ['-introspect'], { encoding: 'utf8' }));
  for (const key of Object.keys(intro)) {
    assert.deepEqual(runtime[key], intro[key], `Runtime metadata: ${key}`);
  }
}
if (process.argv[3]) {
  assert.equal(execFileSync(path.resolve(process.argv[3]), ['--version'], { encoding: 'utf8' }).trim(), tag);
}

// Historical release notes and genuine upstream contributor credit are preserved.
const obsolete = new RegExp(['zoraxy' + '-tunnel', 'ZORAXY' + '_TUNNEL_', 'Zoraxy[ -]' + 'Tunnel(?:[ -]Enhanced)?', '\\[tun' + 'nel\\]'].join('|'), 'i');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of files) {
  if (file === 'CHANGELOG.md' || /\.(png|exe)$/.test(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const credit = 'This project remains licensed under the repository\'s existing MIT license and is based on the original `sniffingsugar/' + 'zoraxy' + '-tunnel` project.';
    if (file === 'README.md' && line === credit) continue;
    assert.ok(!obsolete.test(line), `Obsolete active identifier in ${file}: ${line}`);
  }
}
for (const file of fs.readdirSync('web').filter(file => file.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join('web', file)]);
}
console.log(`Validated Zoraxy Relay v${version}: metadata, asset names, branding, and browser JavaScript`);
