#!/usr/bin/env node
// Vendor a committed presentation package with exact provenance and drift checks.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CHAT_FILES, chatHashes, verifyChat } from './chat/verify.mjs';
const root = import.meta.dirname;
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const destination = args.find(value => value.startsWith('--destination='))?.slice('--destination='.length) || 'shared/chat';
if (!['shared/chat', 'chat'].includes(destination)) throw new Error('Destination must be shared/chat or chat.');
const adopt = args.find(value => value.startsWith('--adopt-marketing-kit='))?.slice('--adopt-marketing-kit='.length);
if (args.some(value => value.startsWith('--') && !value.startsWith('--destination=') && !value.startsWith('--adopt-marketing-kit='))) throw new Error('Unknown sync option.');
let upstream;
if (adopt) {
  upstream = JSON.parse(fs.readFileSync(path.join(root, 'UPSTREAM.json'), 'utf8'));
  if (destination !== 'chat' || adopt !== upstream.commit || !/^[a-f0-9]{40}$/.test(adopt)) throw new Error('Legacy adoption requires the exact recorded MarketingKit source commit.');
}
const sites = args.filter(value => !value.startsWith('--'));
if (!sites.length) throw new Error('Usage: node sync-chat.mjs <consumer-root> [--destination=chat] [--adopt-marketing-kit=COMMIT]');
if (git('status', '--porcelain', '--', 'chat', 'sync-chat.mjs', 'UPSTREAM.json')) throw new Error('Commit the canonical chat package before syncing.');
const commit = git('rev-parse', 'HEAD');
const source = path.join(root, 'chat');
const record = { source: 'rsmith4321/ultralight-ai-dialog', repository: 'https://github.com/rsmith4321/ultralight-ai-dialog', version: JSON.parse(fs.readFileSync(path.join(source, 'package.json'))).version,
  commit, dirty: false, files: chatHashes(source) };
for (const site of sites.map(value => path.resolve(value))) {
  if (!(destination === 'chat' && adopt) && !['package.json', 'react/package.json', 'react-header/package.json'].some(file => fs.existsSync(path.join(site, file)))) throw new Error(`Not a site root: ${site}`);
  const target = path.join(site, destination); const parent = path.dirname(target);
  if (adopt) {
    let targetInfo;
    try { targetInfo = fs.lstatSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!targetInfo?.isDirectory() || targetInfo.isSymbolicLink()) throw new Error('Legacy adoption requires an existing unreceipted source directory.');
    try { fs.lstatSync(path.join(target, 'SOURCE.json')); throw new Error('Legacy adoption requires an unreceipted source directory.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Refuse aliases anywhere above the destination, including broken aliases.
  const pieces = site.split(path.sep).filter(Boolean);
  let prefix = path.parse(site).root;
  for (const piece of pieces) {
    prefix = path.join(prefix, piece);
    try { if (fs.lstatSync(prefix).isSymbolicLink()) throw new Error(`Refusing symlink destination: ${prefix}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // lstat the boundary itself: existsSync follows links and misses broken
  // authored links, which must never be unlinked by the replacement below.
  for (const directory of [site, parent, target]) {
    try {
      if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing symlink destination: ${directory}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (fs.existsSync(target)) {
    // Verify the old package by its recorded file list before replacing it.
    // This admits versioned upgrades that add files without discarding edits.
    const receiptFile = path.join(target, 'SOURCE.json');
    let receiptExists = false;
    try { fs.lstatSync(receiptFile); receiptExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!receiptExists && adopt) {
      if (destination !== 'chat' || adopt !== upstream.commit || !/^[a-f0-9]{40}$/.test(adopt)) throw new Error('Legacy adoption requires the exact recorded MarketingKit source commit.');
      if (execFileSync('git', ['-C', site, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== adopt) throw new Error('MarketingKit HEAD must match the imported source commit.');
      if (execFileSync('git', ['-C', site, 'status', '--porcelain', '--', 'chat'], { encoding: 'utf8' }).trim()) throw new Error('Legacy source has uncommitted chat changes.');
      const names = Object.keys(upstream.files);
      if (JSON.stringify(fs.readdirSync(target).sort()) !== JSON.stringify(names.sort())) throw new Error('Unexpected legacy source files.');
      for (const name of names) {
        if (!/^[a-zA-Z0-9.-]+$/.test(name) || name === '.' || name === '..') throw new Error('Invalid legacy source filename.');
        const file = path.join(target, name), info = fs.lstatSync(file);
        if (!info.isFile() || info.isSymbolicLink() || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== upstream.files[name]) throw new Error('Legacy source drift: ' + name);
      }
    } else {
    const receiptInfo = fs.lstatSync(receiptFile);
    if (!receiptInfo.isFile() || receiptInfo.isSymbolicLink()) throw new Error('Existing chat receipt must be a regular file');
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    if (!['MarketingKit/chat', 'rsmith4321/ultralight-ai-dialog'].includes(receipt.source) || receipt.dirty !== false || !/^[a-f0-9]{40}$/.test(receipt.commit || '') || !receipt.files || typeof receipt.files !== 'object') throw new Error('Invalid existing chat receipt');
    const names = Object.keys(receipt.files);
    if (!names.length || names.some(name => !/^[a-zA-Z0-9.-]+$/.test(name) || name === '.' || name === '..') || JSON.stringify(fs.readdirSync(target).sort()) !== JSON.stringify([...names, 'SOURCE.json'].sort())) throw new Error('Unexpected existing chat files');
    for (const name of names) {
      const file = path.join(target, name); const info = fs.lstatSync(file);
      if (!info.isFile() || info.isSymbolicLink() || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== receipt.files[name]) throw new Error(`Existing chat drift: ${name}`);
    }
    if (JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).version !== receipt.version) throw new Error('Existing chat version differs');
    }
  }
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.chat-'));
  try {
    for (const file of CHAT_FILES) fs.copyFileSync(path.join(source, file), path.join(staging, file), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(path.join(staging, 'SOURCE.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    verifyChat(staging);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  console.log(`${target} <- Ultralight AI Dialog ${record.version} ${commit}`);
}
