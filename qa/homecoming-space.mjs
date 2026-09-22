// Actual admission functions, audio-clock boundaries and inherited bypasses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const s = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const at = s.indexOf('function ' + name + '(');
  assert(at >= 0, name);
  const start = s.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}' && --depth === 0) return s.slice(at, i + 1);
  }
  throw Error('Unclosed ' + name);
}
const data = s.match(/const sysMUS_SPACE = [^;]+;/)?.[0];
assert(data);
const q = vm.createContext({ game: { state: {} }, musPal: {}, musPalN: 0,
  musChaseT: 0, musSleep: 0, musStmt: null, musStmtReq: null,
  musSpaceAt: 0, musSpaceEnd: 0, musSpaceStart: 0, musSpaceRole: '', musSpaceN: 0 });
vm.runInContext(data + '\n' + ['musSpaceRest', 'musSpaceCan', 'musSpaceHold'].map(fn).join('\n'), q);
let checks = 0;
const check = (ok, why) => { assert(ok, why); checks++; };
function reset(pal, rung = 0) {
  q.musPalN = pal; q.musPal = pal === 4 ? { shaku: true } : pal === 20 ? { tranh: true } : {};
  q.game.state = { perfRung: rung };
  q.musSpaceAt = q.musSpaceEnd = q.musSpaceStart = q.musSpaceN = 0;
  q.musSpaceRole = ''; q.musStmt = q.musStmtReq = null; q.musChaseT = q.musSleep = 0;
}
for (const [pal, rest] of [[0, 24], [4, 28], [7, 32], [20, 20]]) {
  for (const rung of [0, 1, 2, 3]) {
    reset(pal, rung);
    check(q.musSpaceRest() === rest, 'authored prototype rest at every rung');
    check(q.musSpaceCan(10, 'lead'), 'first lead admitted');
    q.musSpaceHold(10, 8, 'lead');
    check(q.musSpaceEnd === 18 && q.musSpaceAt === 18 + rest, 'tail then full rest');
    check(!q.musSpaceCan(18 + rest - .001, 'colour'), 'no early colour');
    check(q.musSpaceCan(18 + rest, 'colour'), 'exact boundary admits colour');
    check(q.musSpaceCan(18 + rest, 'lead') === (pal !== 4 && pal !== 20), 'local colour gets its turn');
    q.musSpaceHold(18 + rest, 6, 'colour');
    check(q.musSpaceCan(q.musSpaceAt, 'lead'), 'lead returns after colour');
    check(q.musSpaceN === 2, 'count actual reservations');
    for (const blocked of ['musStmt', 'musStmtReq']) {
      q[blocked] = {}; check(!q.musSpaceCan(1000, 'lead'), 'protect statement'); q[blocked] = null;
    }
    q.musSleep = .5; check(!q.musSpaceCan(1000, 'lead'), 'sleep admits no new phrase'); q.musSleep = 0;
    for (const flag of ['noSereneSpace', 'noSereneScore']) {
      q.game.state[flag] = true;
      check(q.musSpaceRest() === 0 && q.musSpaceCan(0, 'lead'), 'cut restores inherited admission');
      q.musSpaceHold(0, 8, 'lead'); check(q.musSpaceN === 2, 'cut allocates no reservation');
      q.game.state[flag] = false;
    }
    q.musChaseT = 1; check(q.musSpaceRest() === 0 && q.musSpaceCan(0, 'lead'), 'chase bypass');
  }
}
for (const pal of [1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
  reset(pal); check(q.musSpaceRest() === 0, 'other palettes unchanged');
}
reset(0); q.musPal.band = 'salsa'; check(q.musSpaceRest() === 0, 'band clock untouched');
q.musPal = null; check(q.musSpaceRest() === 0, 'pre-palette audit safe');
// Render the shipped melodic-cell schedule into an event list. Stretching
// changes time alone: not pitches, dynamics, instrument or pan.
const cells = s.match(/const sysMUS_CELLS = \[[\s\S]*?\n  \];/)?.[0];
assert(cells);
Object.assign(q, { randInt: () => 1, musMelDeg: 2, musMelCells: 0, musThemeCells: 0,
  sysMUS_PHRASE: [{ gap: 1.2, vel: .7 }], sysMUS_STING: { arrive: { gap: .19 } },
  sysMUS_LIFT_LO: 48, sysMUS_LIFT_HI: 88, musIntensity: .2,
  musVel: v => v, musThemeBase: () => 60, musThemeOff: i => [0, 2, 4, 7, 5, 4, 2, 0][i],
  sysMUS_THEME: [0, 1, 2, 4, 3, 2, 1, 0], sysMUS_THEME_DUR: [2, 1, 1, 3, 2, 1, 1, 3] });
vm.runInContext(cells + '\n' + fn('musFold') + '\n' + fn('musMelCell'), q);
for (const cell of [0, 1, 2, 3, 4, 5]) {
  q.randInt = () => cell; q.musPalN = 0;
  const render = stretch => {
    const events = []; q.musMelDeg = 2;
    q.musLiftNote = (...args) => events.push(args);
    const span = q.musMelCell(10, [48, 52, 55, 59], 'koto', .2, stretch);
    return { events, span };
  };
  const old = render(1), spaced = render(2), omitted = render(undefined);
  check(JSON.stringify(old) === JSON.stringify(omitted), 'default cell remains inherited');
  check(Math.abs(spaced.span - old.span * 2) < 1e-9, 'whole phrase twice as long');
  check(old.events.length === spaced.events.length, 'no extra notes');
  for (let i = 0; i < old.events.length; i++) {
    const a = old.events[i], b = spaced.events[i];
    check(a[0] === b[0] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4], 'timbre pitch pan velocity unchanged');
    check(Math.abs((b[1] - 10) - (a[1] - 10) * 2) < 1e-9 && b[5] === a[5] * 2, 'event placement and duration doubled');
  }
}
console.log('HOMECOMING space: ' + checks + ' audio-clock admission checks pass.');
