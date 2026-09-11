// Regenerates qa/all-task-ids.json from the TASKS table in src/shared.js.
// Run in the same commit as any task table change (see qa/CLOSEOUT.md).
import { readFileSync, writeFileSync } from 'node:fs';
const s = readFileSync('src/shared.js', 'utf8');
const i = s.indexOf('export const TASKS');
const b = s.slice(i, s.indexOf('\n];', i));
const ids = [...b.matchAll(/\bid:\s*'([^']+)'/g)].map(m => m[1]);
writeFileSync('qa/all-task-ids.json', JSON.stringify(ids));
console.log(ids.length + ' task ids written');
