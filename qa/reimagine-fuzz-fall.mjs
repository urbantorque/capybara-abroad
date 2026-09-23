// Pure classifier and shipped wiring only; no browser or gameplay execution.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const source = read('./fuzz.js'), capy = read('../src/capybara.js'), main = read('../src/main.js');
const body = source.split('// FUZZ_FALL_BEGIN:')[1]?.split('// FUZZ_FALL_END')[0];
assert.ok(body, 'actual classifier markers');
const helper = body.slice(body.indexOf('function fuzzFallClassifier'));
const make = vm.runInNewContext('(' + helper.trim() + ')');
let checks = 0;
function ok(value, message) { checks++; assert.ok(value, message); }
function eq(value, expected, message) { checks++; assert.equal(value, expected, message); }
function value(text, name) {
  const m = text.match(new RegExp('const ' + name + '\\s*=\\s*([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\s*;'));
  ok(m, 'authored ' + name); return Number(m[1]) / (m[2] ? Number(m[2]) : 1);
}
const physics = { run: value(capy, 'capyRUN'), accel: value(capy, 'capyACCEL') * value(capy, 'capyAIR_CONTROL'), step: value(main, 'STEP') };
eq(physics.run, 7.4); eq(physics.accel, 19.25); eq(physics.step, 1 / 60);
const g = 24, step = physics.step;
function initial(overrides = {}) {
  return { tick: 1, t: 0, wall: 0, steps: 1, worldStep: 1, motion: [0, 0, 0], p: [0, 40, 0], v: [8, -4, 0], frame: [0, 0], gravity: g,
    grounded: false, swimming: false, carried: true, mounted: true, condorCarrier: true, contacts: false, blocked: false, impulseT: null, ...overrides };
}
function next(s, overrides = {}) {
  const v = [s.v[0], s.v[1] - g * step, s.v[2]];
  return { ...s, tick: s.tick + 1, t: s.t + step, wall: s.wall + step * 1000, worldStep: s.worldStep + 1,
    motion: v.map(x => x * step),
    p: s.p.map((x, i) => x + v[i] * step), v, carried: false, mounted: false, condorCarrier: false, ...overrides };
}
function release(cap = 30, overrides = {}) {
  const f = make(cap, physics); let s = initial(overrides); f.sample(s); s = next(s); f.sample(s);
  eq(f.report().releases, 1, 'observed safe release anchors'); return { f, s };
}
function fall(f, s, n = 100) { for (let i = 0; i < n; i++) { s = next(s); f.sample(s); } return s; }
function rejects(change, label, ticks = 100) {
  const run = release(); run.s = next(run.s, typeof change === 'function' ? change(run.s) : change);
  run.f.sample(run.s); fall(run.f, run.s, ticks);
  eq(run.f.report().certifiedFallFrames, 0, label + ' never re-arms without another carrier');
  ok(run.f.report().unexplainedFrames > 0, label + ' keeps overspeed failure');
}

for (const cap of [30, 34, 50]) {
  const { f, s } = release(cap); fall(f, s, 160);
  ok(f.report().certifiedFallFrames > 0, 'certifies ballistic descent above unchanged cap ' + cap);
  ok(f.report().certifiedFallPeak > cap, 'raw certified peak above ' + cap);
  eq(f.report().unexplainedFrames, 0, 'no unexplained ballistic samples');
  ok(f.report().maxUnexplainedSpeed <= cap, 'unexplained maximum excludes only proven fall');
}
function handoff(verticalDelta) {
  const f = make(30, physics), before = initial({ v: [8, 11, 0] });
  f.sample(before);
  const v = [8, before.v[1] + verticalDelta, 0];
  const s = next(before, { v, motion: v.map(x => x * step),
    p: before.p.map((x, i) => x + v[i] * step) });
  f.sample(s);
  fall(f, s, 160);
  return f.report();
}
{
  const r = handoff(.133);
  eq(r.releases, 1, 'observed condor handoff anchors');
  ok(r.certifiedFallFrames > 0, 'small talon-point correction certifies later gravity fall');
  eq(r.unexplainedFrames, 0, 'small handoff does not erase the 30 m/s ceiling');
}
{
  const r = handoff(.8);
  ok(r.invalidations['vertical impulse'] > 0, 'larger upward handoff still invalidates');
  ok(r.unexplainedFrames > 0, 'later overspeed remains a failure after invalid handoff');
}
rejects({ grounded: true }, 'ground contact');
rejects({ contacts: true }, 'airborne contact');
rejects({ swimming: true }, 'water');
rejects({ blocked: true }, 'pause or hidden');
rejects({ frame: [.01, 0] }, 'moving platform');
rejects({ impulseT: .02 }, 'tagged external shove');
rejects(s => ({ p: [s.p[0] + 10, s.p[1], s.p[2]] }), 'teleport');
rejects(s => ({ v: [s.v[0], -40, s.v[2]] }), 'downward launch');
rejects(s => ({ v: [s.v[0], 40, s.v[2]] }), 'upward launch');
rejects(s => ({ v: [29, s.v[1], 0] }), 'horizontal acceleration');
rejects(s => ({ v: [s.v[0] + 1, s.v[1] - g * step, 0] }), 'under-cap sudden horizontal gain');
rejects(s => ({ t: s.t + .051, wall: s.wall + 51 }), 'simulation gap');
rejects(s => ({ wall: s.wall + 101 }), 'wall-clock gap');
rejects(s => ({ tick: s.tick + 2 }), 'missing observer tick');
rejects({ steps: 12 }, 'unobserved physics interval');
rejects({ steps: 0, motion: [0, 0, 0] }, 'missing postStep observer despite advancing solver');
rejects({ gravity: 25 }, 'gravity change');
rejects({ p: [NaN, 20, 0] }, 'nonfinite position');
rejects({ v: [8, NaN, 0] }, 'nonfinite velocity');
rejects({ frame: [NaN, 0] }, 'nonfinite moving frame');
{
  const { f, s } = release(30, { frame: [1e-36, -1e-40] }); fall(f, s);
  ok(f.report().certifiedFallFrames > 0, 'exponentially decayed platform frame is numerically zero');
  eq(f.report().unexplainedFrames, 0);
}

// A peak without a witnessed carrier release is never explained away.
for (const mode of ['cliff', 'grounded', 'already-fast-release', 'NPC-carry']) {
  const f = make(30, physics);
  let s = initial({ carried: mode === 'already-fast-release' || mode === 'NPC-carry', mounted: mode === 'already-fast-release',
    condorCarrier: mode === 'already-fast-release',
    grounded: mode === 'grounded', v: ['cliff', 'NPC-carry'].includes(mode) ? [8, -4, 0] : [58, 0, 0] });
  f.sample(s); s = next(s); f.sample(s); fall(f, s);
  eq(f.report().releases, 0, mode + ' cannot anchor');
  eq(f.report().certifiedFallFrames, 0, mode + ' cannot certify');
  ok(f.report().unexplainedFrames > 0, mode + ' fails');
}
{
  const { f, s } = release(); let row = next(s, { carried: true, condorCarrier: false }); f.sample(row);
  row = next(row); f.sample(row); fall(f, row);
  eq(f.report().releases, 1, 'NPC pickup invalidates but its release cannot re-arm');
  eq(f.report().certifiedFallFrames, 0);
  ok(f.report().unexplainedFrames > 0);
}
{
  const { f, s } = release(); fall(f, s, 500);
  ok(f.report().invalidations['stale anchor'] > 0, 'anchor expires after eight seconds');
  ok(f.report().unexplainedFrames > 0, 'later long fall remains unexplained');
}
{
  const { f, s } = release(); let row = fall(f, s, 150);
  row = next(row, { grounded: true, v: [58, 0, 0] }); f.sample(row);
  row = next(row, { carried: true, mounted: true, condorCarrier: true, grounded: false, v: [8, -4, 0] }); f.sample(row);
  row = next(row); f.sample(row); fall(f, row, 220);
  ok(f.report().certifiedFallPeak > 58, 'later valid fall is larger than runaway');
  eq(f.report().maxUnexplainedSpeed, 58, 'smaller earlier runaway retained');
  eq(f.report().unexplainedFrames, 1, 'every violating sample counted, not only final peak');
  eq(f.report().violations[0].reason, 'grounded', 'first failure attribution retained');
}
{
  const { f, s } = release();
  // Lose horizontal energy while adding vertical energy: global energy alone
  // could pass, but the independent vertical bound rejects the shove.
  let row = next(s, { v: [0, -7, 0] }); f.sample(row); fall(f, row);
  ok(f.report().invalidations['vertical impulse'] > 0, 'energy exchange cannot hide downward shove');
  eq(f.report().certifiedFallFrames, 0);
}
{
  const { f, s } = release(); let row = s;
  // Plausible acceleration over many samples may not accumulate a fresh
  // integration allowance at every step.
  for (let i = 0; i < 100; i++) {
    row = next(row); row.p[1] += .03; row.motion[1] += .03; f.sample(row);
  }
  ok(f.report().invalidations['energy gain'] > 0, 'energy error cannot accumulate per sample');
  eq(f.report().certifiedFallFrames, 0);
}
for (const [axis, offset] of [[0, .5], [1, -.5], [0, .005], [1, -.005]]) {
  const { f, s } = release(); let row = fall(f, s, 70), before = f.report().certifiedFallFrames;
  for (let i = 0; i < 12; i++) { row = next(row); row.p[axis] += offset; f.sample(row); }
  ok(f.report().invalidations['position jump'] > 0, 'repeated teleport invalidates axis ' + axis + ', offset ' + offset);
  ok(f.report().unexplainedFrames > 0, 'teleported fall remains failure');
  ok(f.report().certifiedFallFrames <= before + 4, 'whole-flight tolerance cannot replenish per tick');
}
{
  const { f, s } = release(); let row = fall(f, s, 70);
  row = next(row, { steps: 0, worldStep: row.worldStep, motion: [0, 0, 0] });
  const result = f.sample(row);
  eq(result.certified, false, 'position cannot advance when solver did not step');
  eq(result.reason, 'position jump');
}
{
  const { f, s } = release(); const row = fall(f, s, 100);
  f.poll({ ...row, observerActive: true });
  eq(f.report().certifiedPolls, 1, 'exact current certified observer sample covers poll');
  eq(f.report().unexplainedPolls, 0);
  f.poll({ ...row, observerActive: false, v: [58, 0, 0] });
  eq(f.report().unexplainedPolls, 1, 'stopped observer cannot cover raw 58m/s');
  eq(f.report().maxUnexplainedSpeed, 58);
  f.poll({ ...row, observerActive: true });
  eq(f.report().unexplainedPolls, 2, 'a restored matching stale sample cannot resurrect invalidated certificate');
}
for (const mismatch of ['time', 'counter', 'position', 'velocity', 'stale', 'replaced']) {
  const { f, s } = release(); const row = fall(f, s, 220);
  ok(f.report().certifiedFallPeak > 58, 'previous certified peak is larger than later poll');
  const poll = { ...row, p: row.p.slice(), v: [58, 0, 0], observerActive: true };
  if (mismatch === 'time') poll.t += step;
  if (mismatch === 'counter') poll.worldStep++;
  if (mismatch === 'position') poll.p[0] += .01;
  if (mismatch === 'stale') poll.wall += 101;
  if (mismatch === 'replaced') poll.observerActive = false;
  f.poll(poll);
  eq(f.report().unexplainedPolls, 1, mismatch + ': earlier greater peak cannot hide unmatched poll');
  eq(f.report().maxUnexplainedSpeed, 58);
  const after = next(row); f.sample(after);
  ok(f.report().unexplainedFrames > 0, 'unmatched poll invalidates active fall');
}
for (const mismatch of ['time', 'counter', 'position', 'stale', 'replaced']) {
  const { f, s } = release(); const row = fall(f, s, 100);
  const poll = { ...row, p: row.p.slice(), v: row.v.slice(), observerActive: true };
  if (mismatch === 'time') poll.t += step;
  if (mismatch === 'counter') poll.worldStep++;
  if (mismatch === 'position') poll.p[0] += .01;
  if (mismatch === 'stale') poll.wall += 101;
  if (mismatch === 'replaced') poll.observerActive = false;
  f.poll(poll);
  eq(f.report().unexplainedPolls, 1, 'equal-speed poll independently rejects ' + mismatch);
}
ok(source.includes('const sysFUZZ_SPEED_MAX = 30;'), 'general ceiling unchanged');
ok(source.includes('const sysFUZZ_SPEED_BY = { drift: 34, goreme: 50 };'), 'chapter ceilings unchanged');
ok(source.includes('value(capy, \'capyRUN\')') && source.includes('value(capy, \'capyACCEL\') * value(capy, \'capyAIR_CONTROL\')'), 'runtime reads controller rows');
ok(source.includes('gravity: -g.world.gravity.y'), 'runtime reads actual world gravity');
ok(source.includes('worldStep: g.world.stepnumber') && source.includes('s.worldStep - previous.worldStep === s.steps'), 'actual solver counter authenticates callback coverage');
ok(source.includes('g.capy.carriedBy === g.condor') && source.includes('previous.condorCarrier'), 'only witnessed condor release can anchor');
ok(source.includes('fallMotion[1] += cb.velocity.y * fallPhysics.step'), 'displacement uses observed solver integration');
ok(source.includes("g.world.addEventListener('postStep', fallContact)"), 'every substep contact retained');
ok(/finally\s*\{\s*g.tick = rawTick; g.world.removeEventListener\('postStep', fallContact\)/.test(source), 'observer cleanup on all loop exits');
ok(source.includes('r.fallSpeed.unexplainedFrames || r.fallSpeed.unexplainedPolls || r.fallSpeed.maxUnexplainedSpeed > speedCap'), 'gate checks all observed and polled violations');
ok(source.includes('if (spd > speedCap) fall.poll(') && source.includes('observerActive: g.tick === fallTickObserver'), 'every polled overspeed verifies observer ownership');
eq((source.match(/const spd = Math\.hypot\(v\.x, v\.y, v\.z\); if \(spd > maxSpeed\) maxSpeed = spd;/g) || []).length, 1, 'speed tracer anchor preserved');
eq((source.match(/biome: g\.biome\.current, started: g\.state\.started,/g) || []).length, 1, 'report tracer anchor preserved');

// Historical captures lack per-substep contacts. Check the claimed energy
// envelope, but never promote that incomplete trace to a certified pass.
let historical = null;
const fixture = new URL('./reimagine-speed-pasto-full-after-v1.json.png', import.meta.url);
if (existsSync(fixture)) {
  const report = JSON.parse(readFileSync(fixture, 'utf8')), raw = report.res.pasto;
  const rows = [...new Map(raw.speedTrace.flatMap(r => r.before).map(r => [r.t, r])).values()].sort((a, b) => a.t - b.t);
  const releases = rows.filter((s, i) => i && rows[i - 1].carried && !s.carried);
  const anchor = releases.at(-1), peak = raw.peakState;
  ok(anchor && peak, 'recorded release and peak present');
  const kineticRise = peak.speed ** 2 - anchor.speed ** 2, gravityAllowance = 2 * g * (anchor.p[1] - peak.p[1]);
  ok(kineticRise <= gravityAllowance, 'recorded Pasto peak fits gravity energy envelope');
  ok(report.fail.some(s => s.includes('maxSpeed 34.6')), 'historical failing row left intact');
  historical = { releaseT: anchor.t, releaseSpeed: anchor.speed, peak: peak.speed, kineticRise, gravityAllowance,
    certified: false, limitation: 'Historical poll trace lacks continuous tick/substep contact evidence. Original failure retained.' };
}
console.log(JSON.stringify({ pass: true, checks, physics, historical }));
