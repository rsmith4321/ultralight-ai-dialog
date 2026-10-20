import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { CHAT_FILES, verifyChat } from '../chat/verify.mjs';

// Exercise the actual CLI in disposable committed Git sources. Never sync
// from or write to canonical package files or real consumer directories.
const canonical = path.resolve(import.meta.dirname, '..');
const scratch = process.env.SHARED_CHAT_TEST_SCRATCH || path.join(os.tmpdir(), 'shared-chat-sync-tests');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const base = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'case-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const source = path.join(base, 'canonical');
  const site = path.join(base, 'site');
  fs.mkdirSync(path.join(source, 'chat'), { recursive: true });
  for (const file of CHAT_FILES) fs.copyFileSync(path.join(canonical, 'chat', file), path.join(source, 'chat', file));
  fs.copyFileSync(path.join(canonical, 'sync-chat.mjs'), path.join(source, 'sync-chat.mjs'));
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Shared chat fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  const commit = message => { git('add', 'chat', 'sync-chat.mjs'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
  commit('Committed current package fixture');
  fs.mkdirSync(site);
  fs.writeFileSync(path.join(site, 'package.json'), '{"private":true}\n');
  return { base, source, site, target: path.join(site, 'shared/chat'), git, commit };
}
function sync(f, site = f.site) {
  return spawnSync(process.execPath, [path.join(f.source, 'sync-chat.mjs'), site], { encoding: 'utf8', timeout: 10_000 });
}
function success(result) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
function refused(result, pattern) {
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0, 'unsafe sync unexpectedly succeeded');
  assert.match(result.stderr + result.stdout, pattern);
}
function snapshot(root) {
  const result = {};
  function visit(directory, relative = '') {
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name), key = path.join(relative, name), info = fs.lstatSync(file);
      if (info.isSymbolicLink()) result[key] = ['symlink', fs.readlinkSync(file)];
      else if (info.isDirectory()) { result[key] = ['directory']; visit(file, key); }
      else result[key] = ['file', fs.readFileSync(file).toString('base64')];
    }
  }
  visit(root);
  return result;
}
function exactReceipt(f) {
  const receipt = verifyChat(f.target);
  assert.deepEqual(receipt, {
    source: 'rsmith4321/ultralight-ai-dialog', repository: 'https://github.com/rsmith4321/ultralight-ai-dialog', version: JSON.parse(fs.readFileSync(path.join(f.source, 'chat/package.json'))).version,
    commit: f.git('rev-parse', 'HEAD'), dirty: false,
    files: Object.fromEntries(CHAT_FILES.map(file => [file, hash(path.join(f.source, 'chat', file))])),
  });
  assert.deepEqual(fs.readdirSync(f.target).sort(), [...CHAT_FILES, 'SOURCE.json'].sort());
  for (const file of CHAT_FILES) assert.deepEqual(fs.readFileSync(path.join(f.target, file)), fs.readFileSync(path.join(f.source, 'chat', file)));
}

test('fresh and repeat sync produce exact receipts and identical package bytes', t => {
  const f = fixture(t);
  success(sync(f)); exactReceipt(f);
  const before = snapshot(path.join(f.site, 'shared'));
  success(sync(f)); exactReceipt(f);
  assert.deepEqual(snapshot(path.join(f.site, 'shared')), before);
});

test('recognized react and react-header consumer roots sync without a root package', async t => {
  for (const directory of ['react', 'react-header']) await t.test(directory, t => {
    const f = fixture(t);
    fs.unlinkSync(path.join(f.site, 'package.json'));
    fs.mkdirSync(path.join(f.site, directory));
    fs.writeFileSync(path.join(f.site, directory, 'package.json'), '{"private":true}\n');
    success(sync(f)); exactReceipt(f);
  });
});

test('edited destination bytes are refused without overwriting anything', t => {
  const f = fixture(t); success(sync(f));
  fs.appendFileSync(path.join(f.target, 'viewport.mjs'), '\n// locally authored destination edit\n');
  const before = snapshot(f.site);
  refused(sync(f), /Existing chat drift/);
  assert.deepEqual(snapshot(f.site), before);
});

test('unexpected destination files are refused without deleting them', t => {
  const f = fixture(t); success(sync(f));
  fs.writeFileSync(path.join(f.target, 'keep-this.txt'), 'recoverable authored fixture file\n');
  const before = snapshot(f.site);
  refused(sync(f), /Unexpected existing chat files/);
  assert.deepEqual(snapshot(f.site), before);
});

test('dirty canonical package is refused and existing destination stays exact', t => {
  const f = fixture(t); success(sync(f));
  fs.appendFileSync(path.join(f.source, 'chat/viewport.mjs'), '\n// uncommitted source fixture\n');
  const before = snapshot(f.site);
  refused(sync(f), /Commit the canonical chat package/);
  assert.deepEqual(snapshot(f.site), before);
});

test('valid previous file set upgrades to the full new package', t => {
  const f = fixture(t);
  const current = Object.fromEntries(CHAT_FILES.map(file => [file, fs.readFileSync(path.join(f.source, 'chat', file))]));
  const added = ['modal.css', 'react.mjs'].filter(file => CHAT_FILES.includes(file));
  assert.ok(added.length > 0, 'fixture requires at least one added package file');
  const oldFiles = CHAT_FILES.filter(file => !added.includes(file));
  for (const file of added) fs.unlinkSync(path.join(f.source, 'chat', file));
  const oldVerify = current['verify.mjs'].toString().replace(/export const CHAT_FILES = \[[\s\S]*?\];/, `export const CHAT_FILES = ${JSON.stringify(oldFiles)};`);
  fs.writeFileSync(path.join(f.source, 'chat/verify.mjs'), oldVerify);
  const oldPackage = JSON.parse(current['package.json']); oldPackage.version = '0.0.0';
  fs.writeFileSync(path.join(f.source, 'chat/package.json'), JSON.stringify(oldPackage));
  f.git('add', '-A', 'chat'); f.git('commit', '-qm', 'Old package with smaller recorded file set');
  success(sync(f));
  const oldReceipt = JSON.parse(fs.readFileSync(path.join(f.target, 'SOURCE.json')));
  assert.deepEqual(Object.keys(oldReceipt.files), oldFiles);
  assert.equal(oldReceipt.version, '0.0.0');
  for (const [file, bytes] of Object.entries(current)) fs.writeFileSync(path.join(f.source, 'chat', file), bytes);
  f.commit('Upgrade package adds modal and React adapter');
  success(sync(f)); exactReceipt(f);
  assert.notEqual(JSON.parse(fs.readFileSync(path.join(f.target, 'SOURCE.json'))).commit, oldReceipt.commit);
});

test('symlink SOURCE receipt is refused and destination plus link target remain unchanged', t => {
  const f = fixture(t); success(sync(f));
  const outside = path.join(f.base, 'external'); fs.mkdirSync(outside);
  const receipt = path.join(outside, 'receipt.json');
  fs.renameSync(path.join(f.target, 'SOURCE.json'), receipt);
  fs.symlinkSync(receipt, path.join(f.target, 'SOURCE.json'));
  const beforeSite = snapshot(f.site), beforeOutside = snapshot(outside);
  refused(sync(f), /receipt.*regular file|symlink/i);
  assert.deepEqual(snapshot(f.site), beforeSite);
  assert.deepEqual(snapshot(outside), beforeOutside);
});

test('symlink package member is refused without overwriting its target', t => {
  const f = fixture(t); success(sync(f));
  const outside = path.join(f.base, 'external'); fs.mkdirSync(outside);
  const member = path.join(outside, 'viewport.mjs');
  fs.renameSync(path.join(f.target, 'viewport.mjs'), member);
  fs.symlinkSync(member, path.join(f.target, 'viewport.mjs'));
  const beforeSite = snapshot(f.site), beforeOutside = snapshot(outside);
  refused(sync(f), /Existing chat drift/);
  assert.deepEqual(snapshot(f.site), beforeSite);
  assert.deepEqual(snapshot(outside), beforeOutside);
});

test('symlink site/shared/chat destination boundaries refuse without changing linked bytes', async t => {
  for (const boundary of ['site', 'shared', 'chat']) await t.test(boundary, t => {
    const f = fixture(t); success(sync(f));
    const outside = path.join(f.base, 'external'); fs.mkdirSync(outside);
    const destination = boundary === 'site' ? f.site : boundary === 'shared' ? path.join(f.site, 'shared') : f.target;
    const moved = path.join(outside, 'original');
    fs.renameSync(destination, moved);
    fs.symlinkSync(moved, destination, 'dir');
    const beforeSite = snapshot(f.site), beforeOutside = snapshot(outside);
    refused(sync(f), /Refusing symlink destination/);
    assert.deepEqual(snapshot(f.site), beforeSite);
    assert.deepEqual(snapshot(outside), beforeOutside);
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), true);
  });
});

test('broken shared/chat symlink is refused and preserved before staging', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.site, 'shared'));
  const missingTarget = path.join(f.base, 'missing-authored-location', 'chat');
  fs.symlinkSync(missingTarget, f.target, 'dir');
  assert.equal(fs.existsSync(f.target), false, 'fixture must be a dangling symlink');
  const before = snapshot(f.site);
  refused(sync(f), /Refusing symlink destination/);
  assert.deepEqual(snapshot(f.site), before);
  assert.equal(fs.lstatSync(f.target).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(f.target), missingTarget);
  assert.equal(fs.existsSync(path.dirname(missingTarget)), false);
});

test('a valid legacy MarketingKit consumer receipt upgrades without discarding local work', t => {
  const f = fixture(t); success(sync(f));
  const receiptFile = path.join(f.target, 'SOURCE.json');
  const old = JSON.parse(fs.readFileSync(receiptFile));
  old.source = 'MarketingKit/chat'; delete old.repository;
  fs.unlinkSync(path.join(f.target, 'LICENSE')); delete old.files.LICENSE;
  fs.writeFileSync(path.join(f.target, 'package.json'), '{"name":"legacy-chat","version":"0.1.3","type":"module"}');
  old.version = '0.1.3'; old.files['package.json'] = hash(path.join(f.target, 'package.json'));
  fs.writeFileSync(receiptFile, JSON.stringify(old));
  success(sync(f)); exactReceipt(f);
});

test('unreceipted MarketingKit adoption requires exact clean Git source and imported hashes', t => {
  const f = fixture(t);
  const legacy = path.join(f.site, 'chat'); fs.mkdirSync(legacy);
  for (const file of CHAT_FILES) fs.copyFileSync(path.join(f.source, 'chat', file), path.join(legacy, file));
  const git = (...args) => execFileSync('git', ['-C', f.site, ...args], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  git('init','-q'); git('config','user.name','Legacy source fixture'); git('config','user.email','fixture@example.invalid');
  git('config','commit.gpgsign','false'); git('config','core.hooksPath','/dev/null');
  git('add','chat'); git('commit','-qm','Original source');
  const original = git('rev-parse','HEAD');
  const upstream = { commit:original, files:Object.fromEntries(CHAT_FILES.map(file => [file,hash(path.join(legacy,file))])) };
  fs.writeFileSync(path.join(f.source,'UPSTREAM.json'),JSON.stringify(upstream)); f.git('add','UPSTREAM.json'); f.commit('Record imported source');
  const adopt = commit => spawnSync(process.execPath,[path.join(f.source,'sync-chat.mjs'),f.site,'--destination=chat',`--adopt-marketing-kit=${commit}`],{encoding:'utf8',timeout:10000});
  const before = snapshot(legacy);
  refused(adopt('0'.repeat(40)), /exact recorded/); assert.deepEqual(snapshot(legacy),before);
  fs.appendFileSync(path.join(legacy,'panel.mjs'),'\n// authored change\n');
  refused(adopt(original),/uncommitted/); assert.match(fs.readFileSync(path.join(legacy,'panel.mjs'),'utf8'),/authored change/);
  // Restore only this test-created fixture to its initial bytes.
  fs.copyFileSync(path.join(f.source,'chat/panel.mjs'),path.join(legacy,'panel.mjs'));
  success(adopt(original)); const receipt = verifyChat(legacy);
  assert.equal(receipt.source,'rsmith4321/ultralight-ai-dialog');
  assert.equal(receipt.commit,f.git('rev-parse','HEAD'));
  fs.unlinkSync(path.join(f.site,'package.json'));
  const upgrade = () => spawnSync(process.execPath,[path.join(f.source,'sync-chat.mjs'),f.site,'--destination=chat'],{encoding:'utf8',timeout:10000});
  success(upgrade());
  assert.equal(verifyChat(legacy).commit,f.git('rev-parse','HEAD'));
  fs.appendFileSync(path.join(legacy,'panel.mjs'),'\n// local edit');
  const beforeUpgrade=snapshot(legacy);
  refused(upgrade(),/Existing chat drift/); assert.deepEqual(snapshot(legacy),beforeUpgrade);
});

test('pre-existing predictable staging directories and symlinks are untouched', async t => {
  for (const kind of ['directory','symlink']) await t.test(kind, t => {
    const f = fixture(t), shared = path.join(f.site,'shared'); fs.mkdirSync(shared);
    const outside = path.join(f.base,'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside,'authored.txt'),'keep outside');
    const preload = `import fs from 'node:fs';import path from 'node:path';const target=path.join(${JSON.stringify(shared)},'.chat-'+process.pid);${kind === 'directory' ? "fs.mkdirSync(target);fs.writeFileSync(path.join(target,'authored.txt'),'keep staging');" : `fs.symlinkSync(${JSON.stringify(outside)},target,'dir');`}fs.writeFileSync(${JSON.stringify(path.join(f.base,'stage-path'))},target);`;
    const result = spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),path.join(f.source,'sync-chat.mjs'),f.site],{encoding:'utf8',timeout:10000});
    success(result); exactReceipt(f);
    const staging = fs.readFileSync(path.join(f.base,'stage-path'),'utf8');
    assert.ok(fs.lstatSync(staging));
    assert.equal(fs.readFileSync(path.join(staging,'authored.txt'),'utf8'),kind === 'directory' ? 'keep staging' : 'keep outside');
    assert.deepEqual(fs.readdirSync(outside),['authored.txt']);
  });
});

test('invalid adoption cannot create a new destination and ancestor aliases are refused', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source,'UPSTREAM.json'),JSON.stringify({commit:'a'.repeat(40),files:{}}));
  f.git('add','UPSTREAM.json'); f.commit('Fixture migration metadata');
  const target = path.join(f.base,'not-a-consumer');
  for (const commit of ['wrong','a'.repeat(40)]) {
    const result=spawnSync(process.execPath,[path.join(f.source,'sync-chat.mjs'),target,'--destination=chat',`--adopt-marketing-kit=${commit}`],{encoding:'utf8',timeout:10000});
    refused(result,/exact recorded|existing unreceipted/); assert.equal(fs.existsSync(target),false);
  }
  const alias=path.join(f.base,'alias'); fs.symlinkSync(f.base,alias,'dir');
  const before=snapshot(f.site); refused(sync(f,path.join(alias,'site')),/symlink destination/); assert.deepEqual(snapshot(f.site),before);
});
