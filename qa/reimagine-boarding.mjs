// REIMAGINE C2: shipped boarding/release functions, controlled talon geometry.
// Input edges and held state stay separate; no browser or physics claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync(new URL('../src/condor.js', import.meta.url), 'utf8'));
function blockEnd(start, text = source) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return i + 1;
  }
  throw Error('Unclosed source block');
}
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'shipped ' + name);
  return source.slice(start, blockEnd(source.indexOf('{', start)));
}
const constants = ['REACH', 'REGRAB_T', 'GRACE_MAX', 'BORED', 'LAUNCH_KICK', 'HANG'].map(name => {
  const row = source.match(new RegExp('^const condor' + name + '\\s*=\\s*[^;]+;', 'm'));
  assert.ok(row, 'shipped constant ' + name);
  return row[0];
});
// Execute the actual in-flight release guard too. A prop thrown on this frame
// must not turn the same E edge into a dismount.
const threwAt = source.indexOf('const threw = !!(game.capy && game.capy.threwAt === game.state.time);');
assert.ok(threwAt >= 0, 'shipped throw guard');
const releaseIf = source.indexOf('if (input && (input.actionPressed && !threw))', threwAt);
assert.ok(releaseIf >= 0, 'shipped release edge');
const releaseGuard = source.slice(threwAt, blockEnd(source.indexOf('{', releaseIf)));
const mountSource = fn('condorMount');
const launchStart = mountSource.indexOf('condorBody.velocity.x += condorFwd.x * condorLAUNCH_KICK;');
const launchEnd = mountSource.indexOf('condorPendOX =', launchStart);
assert.ok(launchStart >= 0 && launchEnd > launchStart, 'shipped launch block boundaries');
const launch = mountSource.slice(launchStart, launchEnd);
const correctionAt = launch.indexOf('const pickupRise =');
assert.ok(correctionAt > 0, 'shipped pickup correction follows authored impulse');
const program = new vm.Script(constants.join('\n') + '\n' +
  ['condorTryMount', 'condorRelease', 'condorPickupReady', 'condorTalonDist', 'condorTalonInReach'].map(fn).join('\n') + '\n' +
  'function flightRelease() { const game = condorGame, input = game.input; ' + releaseGuard + ' }\n' +
  'function pickupLaunch() { const capy = condorGame.capy; ' + launch + ' }\n' +
  'function inheritedLaunch() { const capy = condorGame.capy; ' + launch.slice(0, correctionAt) + ' }');

function vec(x = 0, y = 0, z = 0) {
  return { x, y, z,
    set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; },
    copy(v) { return this.set(v.x, v.y, v.z); },
    cross(v, out) { return out.set(this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); },
  };
}
function quaternion() {
  return { x: 0, y: 0, z: 0, w: 1,
    vmult(v, out) {
      const tx = 2 * (this.y * v.z - this.z * v.y);
      const ty = 2 * (this.z * v.x - this.x * v.z);
      const tz = 2 * (this.x * v.y - this.y * v.x);
      out.set(v.x + this.w * tx + this.y * tz - this.z * ty,
        v.y + this.w * ty + this.z * tx - this.x * tz,
        v.z + this.w * tz + this.x * ty - this.y * tx);
    },
  };
}
function fixture() {
  const q = vm.createContext({
    Math, clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
    condorGame: { input: { action: false, actionPressed: false }, state: { time: 20 },
      capy: { grounded: true, carriedBy: null, body: { position: vec(0, 4, 0), velocity: vec() } },
      world: { removeConstraint(c) { q.removed.push(c); } },
      record: (...args) => q.records.push(args), recordEnd: () => q.recordEnds++, sfx: () => q.sounds++,
    },
    condorBody: { position: vec(0, 6, 0), velocity: vec(3, 4, 5), angularVelocity: vec(0, 2, 0),
      quaternion: quaternion() },
    condorTerrain: () => 0, condorGroundTop: () => 0, condorApi: { active: true },
    condorFwd: vec(0, 0, 1),
    condorTalonLocal: vec(1, -2, 0), condorTmpA: vec(), condorTmpB: vec(),
    condorTalonW: vec(), condorVelSnap: vec(), condorConstraint: null,
    condorRegrabT: 0, condorGrabRelease: false, condorBestAGL: 10,
    condorState: 'circling', condorBoredT: 0, condorLaunchGrace: 0, condorLaunchLift: 0,
    condorTumbleX: 0, condorTumbleY: 0, condorTumbleZ: 0, condorYawOff: 0, condorSettleT: 0,
    mounts: 0, removed: [], records: [], recordEnds: 0, sounds: 0,
    condorMount() {
      q.mounts++; q.condorConstraint = { mounted: q.mounts }; q.condorState = 'carrying';
      q.condorGame.capy.carriedBy = 'condor';
    },
    condorSetState(state) { q.condorState = state; },
  });
  program.runInContext(q);
  q.reach = vm.runInContext('condorREACH', q);
  q.cooldown = vm.runInContext('condorREGRAB_T', q);
  q.at = distance => {
    const offset = vec(); q.condorBody.quaternion.vmult(q.condorTalonLocal, offset);
    const p = q.condorBody.position;
    q.condorGame.capy.body.position.set(p.x + offset.x + distance, p.y + offset.y, p.z + offset.z);
  };
  q.input = q.condorGame.input;
  q.groundTopCalls = [];
  q.tick = () => q.condorTryMount(1 / 60);
  return q;
}
let checks = 0, groups = 0;
const check = (ok, why) => { assert.ok(ok, why); checks++; };
function test(name, run) { try { run(); groups++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
test('released flight gives way to water', () => {
  const update = fn('condorUpdate');
  const cut = update.lastIndexOf('if (capy && capy.body) {');
  check(cut > 0, 'shipped passenger velocity branch');
  const passenger = update.slice(cut, blockEnd(update.indexOf('{', cut), update));
  const program = new vm.Script('function passenger(dt) { const capy = condorGame.capy; ' + passenger + ' }');
  const at = (y, swimming, grounded = false) => {
    const q = { condorState: 'circling', condorLaunchGrace: 1, condorSettleT: 0,
      condorTumbleX: 1, condorTumbleY: 1, condorTumbleZ: 1, condorSETTLE_T: .5,
      condorTerrain: () => 0, condorTumbleCapy() {},
      condorVelSnap: { x: 10 }, condorGame: { capy: { grounded, swimming,
        body: { position: { x: 0, y, z: 0 }, velocity: { x: 2, copy(v) { this.x = v.x; } } } } } };
    vm.createContext(q); program.runInContext(q); vm.runInContext('passenger(1 / 60)', q);
    return { speed: q.condorGame.capy.body.velocity.x, grace: q.condorLaunchGrace };
  };
  const dry = at(8, false);
  check(dry.speed === 10 && dry.grace > 0, 'dry high release retains ballistic snapshot');
  const wet = at(-2, true);
  check(wet.speed === 2 && wet.grace === 0, 'water keeps swim-controlled velocity and ends grace');
  const landed = at(.5, false);
  check(landed.speed === 2 && landed.grace === 0, 'dry landing still ends grace');
});
function mounted() {
  const q = fixture(); q.input.action = true; q.tick();
  check(q.mounts === 1 && q.condorConstraint, 'fixture mounted by held action');
  return q;
}
test('held approach', () => {
  const q = fixture(); q.input.action = true; q.at(q.reach + 2); q.tick();
  check(q.mounts === 0, 'held outside reach does not mount');
  q.at(q.reach - .01); q.tick();
  check(q.mounts === 1, 'entering reach boards without a fresh edge');
  for (let i = 0; i < 30; i++) q.tick();
  check(q.mounts === 1, 'live constraint prevents duplicate mounts');
});
test('tap and reach boundary', () => {
  const q = fixture(); q.input.actionPressed = true; q.at(q.reach); q.tick();
  check(q.mounts === 0, 'tap at strict reach boundary stays out');
  q.at(q.reach - .01); q.tick();
  check(q.mounts === 1, 'tap edge boards without held state');
});
test('ascending leap', () => {
  const q = fixture(); q.condorGame.capy.grounded = false; q.at(q.reach + .5);
  q.condorGame.capy.body.velocity.y = .6; q.tick();
  check(q.mounts === 0, 'exact vertical threshold does not leap-board');
  q.condorGame.capy.body.velocity.y = .61; q.tick();
  check(q.mounts === 1, 'rising leap retains extended reach without E');
});
test('cooldown holds all boarding paths', () => {
  for (const path of ['held', 'tap', 'jump']) {
    const q = fixture(); q.condorRegrabT = .01;
    q.input.action = path === 'held'; q.input.actionPressed = path === 'tap';
    q.condorGame.capy.grounded = path !== 'jump'; q.condorGame.capy.body.velocity.y = 2;
    q.tick(); check(q.mounts === 0, path + ' blocked during cooldown');
    q.condorRegrabT = 0; q.tick(); check(q.mounts === 1, path + ' available after cooldown');
  }
});
test('release preserves flight and latches held key', () => {
  const q = mounted(); const constraint = q.condorConstraint;
  check(q.condorRelease(false), 'release succeeds');
  check(q.removed[0] === constraint && q.condorConstraint === null, 'constraint removed once');
  check(q.condorGame.capy.carriedBy === null && q.condorState === 'circling', 'passenger released and bird circles');
  check(q.condorRegrabT === q.cooldown && q.condorGrabRelease, 'cooldown and held-key latch armed');
  const v = q.condorGame.capy.body.velocity;
  check(v.x === 3 && v.y === 4 && v.z === 3, 'full talon linear plus angular velocity retained');
  check(q.condorVelSnap.z === 3 && q.condorLaunchGrace > 0, 'ballistic grace and velocity snapshot retained');
  check(q.records[0][0] === 'thermal-peak' && q.records[0][1] === 10 && q.recordEnds === 1, 'flight record finalized once');
  check(q.sounds === 1 && !q.condorRelease(false), 'release sound once and second release inert');
  q.condorRegrabT = 0; q.tick();
  check(q.mounts === 1, 'continued held key does not reboard after cooldown');
});
for (const stage of ['out-of-reach', 'cooldown', 'both']) test('keyup rearms ' + stage, () => {
  const q = mounted(); q.condorRelease(true);
  if (stage !== 'cooldown') q.at(q.reach + 10);
  if (stage === 'out-of-reach') q.condorRegrabT = 0;
  q.input.action = false; q.tick();
  check(!q.condorGrabRelease, 'keyup clears latch before distance/cooldown returns');
  check(q.mounts === 1, 'keyup itself never boards');
  q.condorRegrabT = 0; q.at(0); q.input.action = true; q.tick();
  check(q.mounts === 2, 'later held approach boards again');
  check(q.sounds === 0, 'silent release remains silent');
});
test('fresh press overrides release latch', () => {
  const q = mounted(); q.condorRelease(true); q.condorRegrabT = 0;
  q.input.actionPressed = true; q.tick();
  check(q.mounts === 2, 'fresh edge boards even if no keyup frame was sampled');
});
test('missing input clears stale latch safely', () => {
  const q = fixture(); q.condorGrabRelease = true; q.condorGame.input = null; q.tick();
  check(!q.condorGrabRelease && q.mounts === 0, 'no input does not board');
});
test('flight release requires edge and honors prop throw', () => {
  const q = mounted(); q.flightRelease();
  check(q.condorConstraint && q.removed.length === 0, 'held boarding key does not immediately dismount');
  q.input.actionPressed = true; q.condorGame.capy.threwAt = q.condorGame.state.time; q.flightRelease();
  check(q.condorConstraint && q.removed.length === 0, 'same-frame prop throw preserves mount');
  q.condorGame.capy.threwAt--; q.flightRelease();
  check(!q.condorConstraint && q.removed.length === 1 && q.condorGrabRelease, 'ordinary action edge dismounts and latches');
});
let launchCases = 0;
const close = (a, b) => Math.abs(a - b) < 1e-10;
test('pickup impulse across velocity and attitude', () => {
  const q = fixture();
  for (const vy of [-20, -5.756, 0, 2, 12]) for (const pitch of [-.5, -.25, 0, .25, .5]) {
    for (const yaw of [-Math.PI / 2, 0, Math.PI / 3]) {
      launchCases++;
      q.condorFwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const bird = q.condorBody.velocity, passenger = q.condorGame.capy.body.velocity;
      const reset = () => { bird.set(3, vy, -4); passenger.set(3, vy, -4); };
      reset(); q.inheritedLaunch();
      const inherited = { x: bird.x, y: bird.y, z: bird.z };
      reset(); q.pickupLaunch();
      const result = { x: bird.x, y: bird.y, z: bird.z };
      const rise = Math.max(0, 1.5 - inherited.y);
      check(close(bird.x, inherited.x) && close(bird.z, inherited.z), 'horizontal authored impulse unchanged');
      check(close(bird.y, Math.max(1.5, inherited.y)), 'pickup guarantees only the missing upward velocity');
      check(close(bird.y - inherited.y, rise) && rise <= Math.max(0, 1.5 - inherited.y) + 1e-10,
        'correction bounded to vertical deficit');
      check(close(passenger.x, bird.x) && close(passenger.y, bird.y) && close(passenger.z, bird.z),
        'both constrained bodies receive identical impulse');
      if (inherited.y >= 1.5) check(close(bird.y, inherited.y), 'already rising launch receives zero extra impulse');
      check(Number.isFinite(bird.x) && Number.isFinite(bird.y) && Number.isFinite(bird.z), 'finite launch');
      reset(); q.pickupLaunch();
      check(close(bird.x, result.x) && close(bird.y, result.y) && close(bird.z, result.z), 'same pickup has deterministic result');
    }
  }
});
test('measured descending pickup', () => {
  const q = fixture(), before = -5.756, inheritedAfter = -1.348;
  const noseY = (inheritedAfter - before - 1.5) / vm.runInContext('condorLAUNCH_KICK', q);
  q.condorFwd.set(0, noseY, Math.sqrt(1 - noseY * noseY));
  q.condorBody.velocity.set(0, before, 0); q.condorGame.capy.body.velocity.set(0, before, 0);
  q.pickupLaunch();
  check(close(q.condorBody.velocity.y, 1.5), 'observed downward launch becomes 1.5 m/s upward');
  check(close(q.condorGame.capy.body.velocity.y, 1.5), 'passenger receives same measured-case correction');
  check(close(1.5 - inheritedAfter, 2.848), 'measured-case adjustment is bounded 2.848 m/s');
});
test('pickup readiness geometry', () => {
  const q = fixture(), orientation = q.condorBody.quaternion;
  const pitch = angle => Object.assign(orientation, { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) });
  check(q.condorPickupReady(), 'default level clear pass is ready');
  pitch(63 * Math.PI / 180);
  check(!q.condorPickupReady(), 'observed steep downward pass rejected');
  pitch(Math.asin(.1501)); check(!q.condorPickupReady(), 'nose below lower limit rejected');
  pitch(Math.asin(.1499)); check(q.condorPickupReady(), 'nose just above lower limit accepted');
  pitch(-Math.asin(.4501)); check(!q.condorPickupReady(), 'steep climbing pass rejected');
  pitch(-Math.asin(.4499)); check(q.condorPickupReady(), 'nose just below upper limit accepted');
  Object.assign(orientation, { x: 0, y: 0, z: Math.sin(Math.acos(.649) / 2), w: Math.cos(Math.acos(.649) / 2) });
  check(!q.condorPickupReady(), 'over-banked pass rejected');
  Object.assign(orientation, { x: 0, y: 0, z: 1, w: 0 });
  check(!q.condorPickupReady(), 'inverted pass rejected');
  pitch(0); q.condorBody.position.y = 4;
  check(!q.condorPickupReady(), 'four-metre boundary is not enough clearance');
  q.condorBody.position.y = 4.01;
  check(q.condorPickupReady(), 'level pass at 4.01 metres accepted');
  q.condorTerrain = () => 1;
  check(!q.condorPickupReady(), 'clearance measured from local terrain, not sea level');
  q.condorBody = null;
  check(!q.condorPickupReady(), 'missing bird is not ready');
});
test('pickup readiness departure corridor', () => {
  const q = fixture();
  q.condorBody.velocity.set(0, -2, 4);
  const seen = [];
  q.condorGroundTop = (x, z) => { seen.push([x, z]); return 0; };
  check(q.condorPickupReady(), 'clear corridor accepts pickup');
  check(seen.length === 8, 'corridor samples t=0..1.4 in eight steps');
  const kick = vm.runInContext('condorLAUNCH_KICK', q);
  check(Math.abs(seen[7][0] - 0) < 1e-9 && Math.abs(seen[7][1] - (4 + kick) * 1.4) < 1e-9,
    'samples use predicted horizontal launch velocity');

  q.condorGroundTop = (x, z) => z > 1 ? 7.9 : 0;
  check(!q.condorPickupReady(), 'facade ahead rejects pickup');
  q.condorGroundTop = (x, z) => z < -1 ? 7.9 : 0;
  check(q.condorPickupReady(), 'obstacle behind is ignored');
  q.condorGroundTop = (x, z) => z > 1 ? 4.2 : 0;
  check(!q.condorPickupReady(), 'terrain rise ahead rejects pickup');
  q.condorBody.velocity.y = 20;
  check(!q.condorPickupReady(), 'future climb does not waive corridor clearance');

  q.condorBody.velocity.set(0, 0, 0);
  q.condorBody.quaternion.y = Math.sin(Math.PI / 4);
  q.condorBody.quaternion.w = Math.cos(Math.PI / 4);
  q.condorGroundTop = (x, z) => { seen.push([x, z]); return 0; };
  seen.length = 0; q.condorPickupReady();
  check(Math.abs(seen[7][0] - vm.runInContext('condorLAUNCH_KICK', q) * 1.4) < 1e-9 && Math.abs(seen[7][1]) < 1e-9,
    'yaw rotates predicted launch heading');

  seen.length = 0;
  Object.assign(q.condorBody.quaternion, { x: Math.sin(.5), y: 0, z: 0, w: Math.cos(.5) });
  check(!q.condorPickupReady(), 'unsafe pose rejects before corridor scan');
  check(seen.length === 0, 'unsafe pose performs no future scan');
});
test('held intent survives unsafe pass', () => {
  const q = fixture(); q.input.action = true; q.condorBody.position.y = 3; q.at(0);
  check(!q.condorTalonInReach(), 'reach prompt excludes unsafe low pass');
  q.tick(); check(q.mounts === 0, 'held action waits through low pass');
  q.condorBody.position.y = 4.01; q.at(0);
  check(q.condorTalonInReach(), 'reach prompt agrees when pass becomes safe');
  q.tick(); check(q.mounts === 1 && !q.input.actionPressed, 'held action boards safe pass without new edge');
  check(!q.condorTalonInReach(), 'mounted passenger is not offered another pickup');
});
test('tap and leap obey readiness', () => {
  for (const path of ['tap', 'jump']) {
    const q = fixture(); q.input.actionPressed = path === 'tap';
    q.condorGame.capy.grounded = path !== 'jump'; q.condorGame.capy.body.velocity.y = 2;
    Object.assign(q.condorBody.quaternion, { x: Math.sin(.4), y: 0, z: 0, w: Math.cos(.4) });
    q.at(0); q.tick(); check(q.mounts === 0, path + ' rejects steep pass');
    Object.assign(q.condorBody.quaternion, { x: 0, y: 0, z: 0, w: 1 });
    q.at(0); q.tick(); check(q.mounts === 1, path + ' retains boarding on safe pass');
  }
});
console.log(JSON.stringify({ groups, checks, launchCases, failed: 0,
  scope: 'Actual boarding/release/throw guard and launch impulse with controlled geometry/input; browser approach and flight dynamics validated separately.' }, null, 2));
