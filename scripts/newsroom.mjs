import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify, validateBulletin, cleanText } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const location = name => path.join(root, 'data', `${name}.json`);
const read = async name => {
  try { return JSON.parse(await fs.readFile(location(name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && ['queue', 'audit'].includes(name)) return []; throw error; }
};
async function save(name, rows) {
  const file = location(name);
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
  await fs.rename(temp, file);
}
const [command, ...args] = process.argv.slice(2);
const help = `Usage:
  node scripts/newsroom.mjs list
  node scripts/newsroom.mjs submit <draft.json>
  node scripts/newsroom.mjs approve <id> <editor> --evidence-reviewed --rights-reviewed [--corroborated] [--senior-editor=Name]
  node scripts/newsroom.mjs reject <id> <editor> <reason>
  node scripts/newsroom.mjs correct <id> <replacement.json> <editor> <reason> --evidence-reviewed --rights-reviewed [--corroborated] [--senior-editor=Name]
  node scripts/newsroom.mjs retract <id> <editor> <reason>

No automated approval. This writes local JSON; review and commit changes deliberately.`;
const flag = name => args.includes(name);
const argValue = name => args.find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
const stamp = () => new Date().toISOString();
const record = (action, id, editor, detail = '') => ({ action, id, editor, detail, at: stamp() });

try {
  if (command === 'list') {
    const queue = await read('queue');
    const published = await read('bulletins');
    console.log(JSON.stringify({ pending: queue.map(x => ({ id: x.id, headline: x.headline, section: x.section, risk: x.risk })), published: published.map(x => ({ id: x.id, headline: x.headline, status: x.status })) }, null, 2));
  } else if (command === 'submit') {
    if (!args[0]) throw new Error(help);
    const draft = JSON.parse(await fs.readFile(path.resolve(args[0]), 'utf8'));
    const errors = validateBulletin(draft);
    if (errors.length) throw new Error(errors.join('; '));
    const id = cleanText(draft.id) || slugify(draft.headline);
    if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid slug/id');
    const queue = await read('queue');
    const published = await read('bulletins');
    if ([...queue, ...published].some(x => x.id === id)) throw new Error(`Duplicate bulletin id: ${id}`);
    queue.push({ ...draft, id, status: 'pending', submitted_at: stamp() });
    await save('queue', queue);
    console.log(`Submitted ${id} for editorial review. NOT published.`);
  } else if (command === 'approve') {
    const [id, editor] = args;
    if (!id || !cleanText(editor)) throw new Error(help);
    if (!flag('--evidence-reviewed') || !flag('--rights-reviewed')) throw new Error('Explicit evidence and rights review flags are required');
    const queue = await read('queue');
    const pos = queue.findIndex(x => x.id === id);
    if (pos < 0) throw new Error(`Pending draft not found: ${id}`);
    const item = queue[pos];
    if (['high', 'contested'].includes(item.risk) && !flag('--corroborated')) throw new Error('High-risk or contested stories require --corroborated');
    const candidate = { ...item, editor, evidence_checked: true, rights_checked: true, senior_editor: argValue('--senior-editor') || null };
    const errors = validateBulletin(candidate, { forPublication: true });
    if (errors.length) throw new Error(errors.join('; '));
    const published = await read('bulletins');
    if (published.some(x => x.id === id)) throw new Error('Already published');
    const publishedAt = stamp();
    published.push({ ...candidate, status: 'published', published_at: publishedAt, updated_at: publishedAt, revision: 1 });
    queue.splice(pos, 1);
    await save('bulletins', published);
    await save('queue', queue);
    const audit = await read('audit'); audit.push(record('publish', id, editor)); await save('audit', audit);
    console.log(`Approved and stored ${id}. Run npm run build to update site; no remote deployment performed.`);
  } else if (command === 'reject') {
    const [id, editor, ...reasonParts] = args;
    const reason = reasonParts.join(' ');
    if (!id || !editor || reason.length < 12) throw new Error('Required: id editor meaningful rejection reason');
    const queue = await read('queue');
    const pos = queue.findIndex(x => x.id === id);
    if (pos < 0) throw new Error('Draft not in queue');
    queue.splice(pos, 1);
    await save('queue', queue);
    const audit = await read('audit'); audit.push(record('reject', id, editor, reason)); await save('audit', audit);
    console.log(`Rejected ${id}`);
  } else if (command === 'correct') {
    const [id, replacementFile, editor, ...rest] = args;
    const reason = rest.filter(x => !x.startsWith('--')).join(' ');
    if (!id || !replacementFile || !editor || reason.length < 12 || !flag('--evidence-reviewed') || !flag('--rights-reviewed')) throw new Error('Correction requires id, replacement file, editor, reason, --evidence-reviewed, --rights-reviewed');
    const bulletins = await read('bulletins');
    const pos = bulletins.findIndex(x => x.id === id && x.status === 'published');
    if (pos < 0) throw new Error('Published story not found');
    const previous = bulletins[pos];
    const replacement = JSON.parse(await fs.readFile(path.resolve(replacementFile), 'utf8'));
    if (replacement.id && replacement.id !== id) throw new Error('Correction cannot change canonical id');
    if (replacement.section !== previous.section) throw new Error('Section changes need a separate editorial workflow');
    const updated = { ...replacement, id, editor, evidence_checked: true, rights_checked: true, senior_editor: argValue('--senior-editor') || null, risk: replacement.risk || previous.risk };
    const errors = validateBulletin(updated, { forPublication: true });
    if (errors.length) throw new Error(errors.join('; '));
    if (['high', 'contested'].includes(updated.risk) && !flag('--corroborated')) throw new Error('High-risk correction requires --corroborated');
    const audit = await read('audit'); audit.push({ ...record('correction', id, editor, reason), previous });
    bulletins[pos] = { ...updated, status: 'published', published_at: previous.published_at, updated_at: stamp(), correction_note: reason, revision: previous.revision + 1 };
    await save('bulletins', bulletins); await save('audit', audit);
    console.log(`Correction saved for ${id}; history preserved.`);
  } else if (command === 'retract') {
    const [id, editor, ...reasonParts] = args;
    const reason = reasonParts.join(' ');
    if (!id || !editor || reason.length < 12) throw new Error('Retraction needs id, editor and detailed reason');
    const bulletins = await read('bulletins');
    const item = bulletins.find(x => x.id === id && x.status === 'published');
    if (!item) throw new Error('Published story not found');
    item.status = 'retracted'; item.retraction_note = reason; item.updated_at = stamp(); item.revision += 1;
    await save('bulletins', bulletins);
    const audit = await read('audit'); audit.push(record('retract', id, editor, reason)); await save('audit', audit);
    console.log(`Retraction recorded for ${id}; article URL preserved with notice.`);
  } else {
    console.log(help);
    if (command) process.exitCode = 1;
  }
} catch (error) { console.error(`Newsroom: ${error.message}`); process.exitCode = 1; }
