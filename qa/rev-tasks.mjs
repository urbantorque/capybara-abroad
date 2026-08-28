import fs from 'node:fs';

const sh = fs.readFileSync('src/shared.js', 'utf8');
const start = sh.indexOf('export const TASKS');
const end = sh.indexOf('\n];', start);
const blk = sh.slice(start, end);

const re = /\{\s*id:\s*'([^']+)'([^}]*)\}/g;
let m;
const tasks = [];
while ((m = re.exec(blk))) {
  const rest = m[2];
  const ch = /chapter:\s*(\d+)/.exec(rest);
  const wow = /wow:\s*'([^']*)'/.exec(rest);
  tasks.push({ id: m[1], ch: ch ? +ch[1] : 0, wow: wow ? wow[1] : null });
}

const files = fs.readdirSync('src').filter((f) => f.endsWith('.js'));
const srcByFile = {};
for (const f of files) srcByFile[f] = fs.readFileSync('src/' + f, 'utf8');

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Chapter -> the file(s) that own it, so "who could complete this" is answerable.
const OWNER = {
  1: ['environment.js', 'npc.js', 'props.js'], 2: ['pasto.js', 'condor.js', 'npc.js', 'props.js'],
  3: ['quay.js'], 4: ['kyoto.js'], 5: ['cali.js'], 6: ['rio.js'], 7: ['iceland.js'],
  8: ['sahara.js'], 9: ['drift.js'], 10: ['venice.js'], 11: ['kowloon.js'], 12: ['palawan.js'],
  13: ['goreme.js'], 14: ['manly.js'], 15: ['pantanal.js'], 16: ['cave.js'], 17: ['antarctic.js'],
  18: ['monaco.js'], 19: ['hanoi.js'],
};

const rows = [];
for (const t of tasks) {
  const id = esc(t.id);
  // the literal in a CALL position: fooTask('id'), complete('id'), done('id') ...
  // the id as ANY argument: fooTask('id'), manTask(game, 'id'), done(g, 'id', 2)
  const call = new RegExp('[A-Za-z_$][\\w$]*\\s*\\([^();]{0,60}[\'"`]' + id + '[\'"`]', 'g');
  // ...or assigned/pushed into a structure that a call later reads
  const lit = new RegExp('[\'"`]' + id + '[\'"`]', 'g');

  let nCall = 0, nLit = 0;
  const where = [];
  for (const f of files) {
    const c = (srcByFile[f].match(call) || []).length;
    const l = (srcByFile[f].match(lit) || []).length;
    nCall += c; nLit += l;
    if (l) where.push(f.replace('.js', '') + (c ? '*' : '') + ':' + l);
  }
  // does the chapter that OWNS it mention it at all?
  const owners = OWNER[t.ch] || [];
  const inOwner = owners.some((f) => srcByFile[f] && lit.test(srcByFile[f]));
  rows.push({ ...t, nCall, nLit, where, inOwner });
}

const noCall = rows.filter((r) => r.nCall === 0);
const notInOwner = rows.filter((r) => !r.inOwner && r.ch >= 1);

console.log('tasks in table: ' + tasks.length);
console.log('');
console.log('=== A. NEVER APPEARS IN A CALL POSITION ANYWHERE ===');
console.log('(nothing in src/ passes this id to a function -> cannot be completed)');
for (const r of noCall) {
  console.log('  ch' + String(r.ch).padStart(2), r.id.padEnd(22), 'refs=' + String(r.nLit).padStart(2), ' ' + r.where.join(' '));
}
console.log('  -> ' + noCall.length + ' of ' + tasks.length);
console.log('');
console.log('=== B. THE CHAPTER THAT OWNS IT NEVER MENTIONS IT ===');
console.log('(completed by shared machinery, or by nobody - each needs a look)');
for (const r of notInOwner) {
  console.log('  ch' + String(r.ch).padStart(2), r.id.padEnd(22), 'refs=' + String(r.nLit).padStart(2), ' ' + r.where.join(' '));
}
console.log('  -> ' + notInOwner.length + ' of ' + tasks.length);
