// Execute shipped arrangements with recording instruments. This measures
// admission and protected beats, not sound quality or listening preference.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  let i = source.indexOf('{', start), depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error('unclosed ' + name);
}
const names = ['musBar','musSalsaBar','musSambaBar','musGnawaCell','musBaroqueBar','musHkBar','musBondBar'];
const code = [fn('musSereneBand'), ...names.map(fn)].join('\n');
const events = [];
const q = vm.createContext({ game: { state: {} }, musChaseT: 0, musIntensity: 0,
  musChordStart: 0, musPrevChord: null, musCurChord: [48,52,55,59,62], musIdx: 0,
  musPal: { roots: [36,41], next: [[1],[0]] }, musBandHits: 0, musBandBars: 0,
  musChaseHit: 0, musBondHeat: 0, musHkShow: 0, musGnawaBuild: 0, musGnawaStrip: 0,
  musVenTide: 0, musFeel: t => t, musVel: v => v, musFold: n => n,
  clamp: (x,a,b) => Math.max(a,Math.min(b,x)), randInt: a => a,
  Math: Object.assign(Object.create(Math), { random: () => .1 }) });
for (const name of new Set(code.match(/\bmus\w+(?=\()/g))) {
  if (names.includes(name) || name === 'musSereneBand' || q[name]) continue;
  q[name] = (...args) => events.push({ name, args });
}
const loaded = new Set();
function constant(name) {
  if (loaded.has(name)) return;
  const match = source.match(new RegExp('const ' + name + '\\s*=\\s*([^;]+);'));
  assert(match, 'constant ' + name);
  loaded.add(name);
  for (const dep of new Set(match[1].match(/\bsysMUS_\w+/g) || [])) constant(dep);
  vm.runInContext(match[0], q);
}
for (const name of new Set(code.match(/\bsysMUS_\w+/g))) constant(name);
constant('sysMUS_RHY');
vm.runInContext(code, q);
const call = name => {
  events.length = 0;
  for (let bar = 0; bar < 16; bar++) {
    q.t = 10 + bar * 4; q.bar = bar;
    vm.runInContext(name === 'musBar' ? 'musBar(t, sysMUS_RHY)' :
      name === 'musSalsaBar' || name === 'musSambaBar' ? name + '(t,bar%2,false)' : name + '(t,bar)', q);
  }
  return structuredClone(events);
};
const core = { musBar:['musBombo'], musSalsaBar:['musClave','musConga','musTumbaoNote','musMontunoNote'],
  musSambaBar:['musSurdo','musTamborim','musSambaBassNote','musCavaco'],
  musGnawaCell:['musQraqeb','musGuembri'], musBaroqueBar:['musCello','musOrganPedal'],
  musHkBar:['musHkKick','musHkSnare','musHkBass','musGuzheng'], musBondBar:['musUpright','musTwang','musBrush'] };
let checks = 0;
for (const name of names) {
  q.game.state.noSereneScore = true; const full = call(name);
  q.game.state.noSereneScore = false; const calm = call(name);
  assert(calm.length < full.length, name + ' fewer admitted notes'); checks++;
  const beats = rows => rows.filter(e => core[name].includes(e.name));
  assert(beats(full).length, name + ' recorded core instrument');
  assert.deepEqual(beats(calm), beats(full), name + ' core beat unchanged'); checks += 2;
  q.musChaseT = 3;
  const chase = call(name); q.game.state.noSereneScore = true;
  assert.deepEqual(call(name), chase, name + ' chase untouched'); checks++;
  q.musChaseT = 0;
  q.musIntensity = .5; q.game.state.noSereneScore = false;
  const active = call(name); q.game.state.noSereneScore = true;
  assert.deepEqual(call(name), active, name + ' active arrangement untouched'); checks++;
  q.musIntensity = 0;
  console.log(name + ': ' + full.length + ' -> ' + calm.length + ' events / 16 bars');
}
for (const rung of [0,1,2,3]) {
  q.game.state.perfRung = rung; q.game.state.noSereneScore = false;
  assert(q.musSereneBand(0)); assert(!q.musSereneBand(.5));
  q.musIntensity = .3; assert(!q.musSereneBand(0)); q.musIntensity = 0;
  checks += 3;
}
console.log(checks + ' regional admission checks pass');
