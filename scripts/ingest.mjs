import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pollSources } from './monitor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = file => path.join(root, 'data', file);
const read = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(data(file), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
const save = async (file, value) => {
  const target = data(file);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await fs.rename(temp, target);
};
const scheduled = process.argv.includes('--scheduled');
const dryRun = process.argv.includes('--dry-run');
try {
  const sources = await read('sources.json', []);
  const inbox = await read('inbox.json', []);
  const feedState = await read('feed-state.json', {});
  const result = await pollSources({ sources, inbox, feedState, scheduled });
  if (!dryRun) {
    await save('inbox.json', result.inbox);
    await save('feed-state.json', result.feedState);
    await save('monitor-health.json', result.health);
  }
  console.log(JSON.stringify({ ...result.health, dry_run: dryRun }, null, 2));
  if (result.health.failed) process.exitCode = 1;
} catch (error) {
  console.error(`FMB monitor: ${error.message}`);
  process.exitCode = 1;
}
