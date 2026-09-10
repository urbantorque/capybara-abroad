const fs = require('fs');
const f = process.argv[2] || 'qa/throwhit.json.png';
const o = JSON.parse(fs.readFileSync(f).toString());
console.log('started', o.started, '| consoleErrors', o.errs.length, JSON.stringify(o.errs));
let S = 0, C = 0, N = 0, FL = 0, RE = 0, H = 0, NM = 0, FM = 0;
for (const r of o.rows) {
  S += r.shots; C += r.contacts; N += r.nOver; RE += r.reactOver;
  FL += r.flOver * r.nOver; NM += r.nMiss; FM += r.flMiss * r.nMiss;
  H += (r.audit ? r.audit.hits : 0);
  console.log('==', r.biome.padEnd(8), '| people', String(r.people).padStart(2),
    '| shots', r.shots, '| personContacts', r.contacts,
    '| aboveGate', r.nOver, '| ruleHits', r.audit ? r.audit.hits : 'n/a',
    '| ruleBlocked', r.audit ? r.audit.blocked : 'n/a',
    '\n              victim flinch peak (mean/max on hits)', r.flOver + '/' + r.flOverMax,
    '| on non-hit shots', r.flMiss,
    '| victim entered a fright state', r.reactOver + '/' + r.nOver,
    '\n              npc:startled per hit', r.stOver, '| chain', r.chain,
    '| ownedProps', r.owned, 'lost', r.ownedBad, '| lastError', r.err);
}
console.log('TOTAL shots', S, '| personContacts', C, '| aboveGate', N,
  '| ruleHits', H, '| mean victim flinch peak on a hit',
  (N ? FL / N : 0).toFixed(2), '| on a non-hit shot', (NM ? FM / NM : 0).toFixed(2),
  '| victim entered a fright state', RE + '/' + N);
