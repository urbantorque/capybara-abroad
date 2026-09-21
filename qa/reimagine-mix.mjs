// REIMAGINE F1. Shipped writers, captured AudioParam targets; no audio mocks
// masquerading as listening evidence. Browser meters cover actual signals.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const at = source.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name);
  const start = source.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  throw Error('unclosed ' + name);
}
const param = () => ({ value: 0, calls: [], setTargetAtTime(value, time, tau) {
  this.value = value; this.calls.push({ value, time, tau });
} });
const gain = () => ({ gain: param() });
const b = { rain: 1, wind: 1, chirp: 1, rustle: 1, drip: 0 };
const q = vm.createContext({
  game: { state: { started: true, perfRung: 0 }, weather: { bed: () => b },
    biome: { current: 'sydney' }, capy: { worn: '' } },
  document: { hidden: false }, muted: false, ac: { currentTime: 10, state: 'running' },
  acAmbGain: gain(), acAmbOn: false, acAmbWant: -1,
  wxBedBus: gain(), wxBedRain: gain(), wxBedWind: gain(), wxBedChirp: gain(), wxBedRustle: gain(),
  wxBedRainBP: { frequency: param() }, wxBedWindLP: { frequency: param() },
  sysBedRush: null, sysBedScrape: null, musIntensity: 0.3, musSleep: 0.8,
  sysWX_DUCK: 0.45, sysWX_BED_MAX: 0.19, sysWX_BED_TAU: 0.85, sysMUS_SLEEP_BEDS: 0.41,
  musStmt: null, clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
  sysMovers: [], audioEar() {}, sysBedsAtTick() {}, biomePre: '',
  audioPlace: () => 1, sysMOVER_JCUT_GAIN: 0.25, sysMOVER_CALM: 0.5,
  sysCalmNow: 1, sysSfxPan: 0, sysSfxBack: 0, sysSfxUp: 0,
  sysEarTo: { length: () => 0 }, sysMOVER_FLAT: 12,
  sysMUS_SIDE: { depth: 0.5, flowPad: 0.29 }, musWorldEnv: 0.8, sysFlowNow: 1,
});
for (const name of ['sysScoreForeground', 'sysScoreBedPhrase', 'ambientSet', 'sysWxBedSet']) {
  vm.runInContext(fn(name), q);
}
// Execute the candidate-level half unchanged. Node allocation/Doppler is
// unrelated to this mix layer and remains covered by the browser probe.
const mover = fn('sysMoverTick');
vm.runInContext(mover.slice(0, mover.indexOf('sysMovers.sort(')) + '}', q);
const side = source.match(/const sideWant = 1 - \(sysScoreForeground\(\)[^;]+;/)?.[0];
const flow = source.match(/const flowPad = 1 - \(sysScoreForeground\(\)[^;]+;/)?.[0];
assert.ok(side && flow);
vm.runInContext('function scoreTargets() {' + side + flow + 'return [sideWant,flowPad];}', q);
let checks = 0;
const check = (v, why) => { assert.ok(v, why); checks++; };
const near = (a, b, why) => check(Math.abs(a - b) < 1e-10, why + ': ' + a + ' vs ' + b);
const reset = (cut = false, rung = 0) => {
  Object.assign(q.game.state, { noQuiet: cut, perfRung: rung, paused: false, started: true });
  q.document.hidden = false; q.muted = false; q.musStmt = null;
};
reset();
q.ambientSet(true);
near(q.acAmbGain.gain.value, 0.016, 'generic wash lowered');
const writes = q.acAmbGain.gain.calls.length;
q.ambientSet(true);
check(q.acAmbGain.gain.calls.length === writes, 'unchanged wash does not rewrite automation');
q.musStmt = { ended: false }; q.ambientSet(true);
near(q.acAmbGain.gain.value, 0.0088, 'live phrase makes room');
q.musStmt = null; q.ambientSet(true);
near(q.acAmbGain.gain.calls.at(-1).tau, 4, 'wash returns over four seconds');
for (const mode of [[true, 0], [false, 1], [false, 2]]) {
  reset(...mode); q.ambientSet(true);
  near(q.acAmbGain.gain.value, 0.05, 'live mix toggle restores on wash without off edge');
  q.sysWxBedSet(1 / 60);
  near(q.wxBedBus.gain.value, 0.19 * 0.865 * 1.328, 'legacy sleep weather gain');
  for (const [key, v] of [['Rain', 0.62], ['Wind', 0.5], ['Chirp', 0.03], ['Rustle', 0.085]]) {
    near(q['wxBed' + key].gain.value, v, 'legacy weather ' + key);
  }
  const s = q.scoreTargets();
  near(s[0], 0.6, 'legacy sidechain'); near(s[1], 0.71, 'legacy movement pad');
}
reset(); q.sysWxBedSet(1 / 60);
near(q.wxBedBus.gain.value, 0.19 * 0.865, 'no sleep amplification');
for (const [key, v] of [['Rain', 0.45], ['Wind', 0.3], ['Chirp', 0.015], ['Rustle', 0.0425]]) {
  near(q['wxBed' + key].gain.value, v * 0.11 / 0.19, 'foreground weather ' + key);
}
const liveRain = q.wxBedRain.gain.value;
q.musStmt = { ended: false }; q.sysWxBedSet(1 / 60);
near(q.wxBedRain.gain.value, liveRain * 0.55, 'weather yields to statement');
q.musStmt.ended = true; q.sysWxBedSet(1 / 60);
near(q.wxBedRain.gain.value, liveRain, 'ended statement releases weather');
for (const mode of ['paused', 'hidden', 'muted', 'notStarted']) {
  reset();
  if (mode === 'paused') q.game.state.paused = true;
  if (mode === 'hidden') q.document.hidden = true;
  if (mode === 'muted') q.muted = true;
  if (mode === 'notStarted') q.game.state.started = false;
  q.sysWxBedSet(1 / 60);
  near(q.wxBedBus.gain.value, 0.0001, mode + ' silences weather bus');
}
reset(); q.ambientSet(false);
near(q.acAmbGain.gain.value, 0.0001, 'wash off');
function candidates() {
  q.sysMovers = ['sea', 'air', 'tune', 'car'].map(kind => ({ key: kind, kind,
    bed: kind !== 'car', biome: 'sydney', level: 1, amp: 1, near: 0, far: 99 }));
  q.sysMoverTick(1 / 60);
  return q.sysMovers.map(m => m.want);
}
let c = candidates();
near(c[0], 0.5, 'sea lowered without rest boost'); near(c[1], 0.28, 'redundant air lowered further');
near(c[2], 1.5 * 1.328, 'placed instrument unchanged'); near(c[3], 1, 'vehicle unchanged');
q.musStmt = { ended: false }; c = candidates();
near(c[0], 0.275, 'sea yields to theme'); near(c[1], 0.154, 'air yields to theme');
near(c[2], 1.5 * 1.328, 'theme never suppresses placed instrument');
reset(true); c = candidates();
near(c[0], 1.5 * 1.328, 'cut restores sea'); near(c[1], 1.5 * 1.328, 'cut restores air');
reset(false, 1); c = candidates();
near(c[0], 1.5 * 1.328, 'governor restores sea');
reset(); const s = q.scoreTargets();
near(s[0], 0.8, 'shallower world sidechain'); near(s[1], 1, 'walking no longer removes pad');
// The cross-file priority hook reports only visible guidance and fresh
// receipts. Classification and admission belong to npc.js, not this hook.
const hold = source.match(/incidentalQuiet:\s*(function \(\) \{[\s\S]*?\n\s*\}),/)?.[1];
assert.ok(hold);
Object.assign(q, { tutOn: false, tutEl: null, sysTickLastAt: 0 });
q.game.state.time = 100;
vm.runInContext('var incidentalHeld = ' + hold, q);
check(!q.incidentalHeld(), 'ordinary world does not suppress incidental speech');
q.tutOn = true; q.tutEl = { parentNode: {}, dataset: {} };
check(q.incidentalHeld(), 'visible teaching has priority');
q.tutEl.dataset.going = '1';
check(!q.incidentalHeld(), 'departing tutorial no longer holds the world');
q.tutOn = false; q.sysTickLastAt = 98.1;
check(q.incidentalHeld(), 'receipt has two seconds of priority');
q.sysTickLastAt = 98;
check(!q.incidentalHeld(), 'receipt boundary releases exactly');
console.log(checks + ' foreground-mix target assertions passed');
