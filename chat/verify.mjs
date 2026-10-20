import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const CHAT_FILES = ['LICENSE', 'README.md', 'launcher.mjs', 'panel.mjs', 'styles.mjs', 'viewport.mjs', 'modal.css', 'react.mjs', 'contact.mjs', 'package.json', 'verify.mjs'];
export const CHAT_RECEIPT = 'SOURCE.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function chatHashes(directory) {
  return Object.fromEntries(CHAT_FILES.map(file => {
    const target = path.join(directory, file);
    const info = fs.lstatSync(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Shared chat: expected regular file ${file}.`);
    return [file, hash(fs.readFileSync(target))];
  }));
}
export function verifyChat(directory = import.meta.dirname) {
  const receiptFile = path.join(directory, CHAT_RECEIPT);
  const info = fs.lstatSync(receiptFile);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Shared chat: invalid source receipt.');
  const record = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  const actual = chatHashes(directory);
  const version = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).version;
  if (record.source !== 'rsmith4321/ultralight-ai-dialog' || !/^[a-f0-9]{40}$/.test(record.commit || '') || record.version !== version
      || record.dirty !== false || JSON.stringify(record.files) !== JSON.stringify(actual)) throw new Error('Shared chat: vendored package drift; sync a committed canonical chat package.');
  const entries = fs.readdirSync(directory).sort();
  const expected = [...CHAT_FILES, CHAT_RECEIPT].sort();
  if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error('Shared chat: unexpected files in vendored package.');
  return record;
}
