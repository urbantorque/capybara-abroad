import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as CANNON from '../vendor/cannon-es.js';
import { stripComments } from '../strip-comments.mjs';

const raw = readFileSync(new URL('../src/props.js', import.meta.url), 'utf8');
const source = stripComments(raw);
function extract(name) {
  const m = source.match(new RegExp(`function\\s+${name}\\s*\\(`));
  assert.ok(m, `missing ${name}`);
  const open = source.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}' && --depth === 0) return source.slice(m.index, i + 1);
  }
  assert.fail(`unclosed ${name}`);
}
const queue = extract('physQueueImpact');
const flush = extract('physFlushImpacts');
const collide = extract('physOnCollide');
assert.equal((source.match(/game\.world\.addEventListener\('postStep', physFlushImpacts\)/g) || []).length, 1);
assert.ok(extract('createProps').includes("game.world.addEventListener('postStep', physFlushImpacts)"));
function authoredNumber(name) {
  const m = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+)`));
  assert.ok(m, `missing authored ${name}`);
  return Number(m[1]);
}
const IMPACT = authoredNumber('physIMPACT_MIN');
const SPILL = authoredNumber('physSPILL_MIN');
const SHATTER = authoredNumber('physSHATTER_MIN');
const BARGE = authoredNumber('physBARGE_MIN');
const BARGE_K = authoredNumber('physBARGE_K');
const BARGE_DV = authoredNumber('physBARGE_DV');
const BARGE_UP = authoredNumber('physBARGE_UP');
const pho = source.match(/phobowl:\s*\{([\s\S]*?)\n\s*\},/);
assert.ok(pho && /fragile:\s*true/.test(pho[1]), 'phobowl fragile authoring');
const coffee = source.match(/coffee:\s*\{([\s\S]*?)\n\s*\},/);
assert.ok(coffee && /spill:\s*physBuildCoffeeSpill/.test(coffee[1]), 'coffee spill authoring');

function makeApi(capy, counters, immediate = false) {
  const context = {
    physShatter(prop) {
      counters.shatter += 1;
      prop.hidden = true;
      prop.body.position.set(prop.homeX, -900, prop.homeZ);
      prop.body.velocity.set(0, 0, 0);
      prop.body.angularVelocity.set(0, 0, 0);
      prop.body.force.set(0, 0, 0);
      prop.body.torque.set(0, 0, 0);
      prop.body.collisionResponse = false;
      prop.body.sleep();
      prop.body.type = CANNON.Body.STATIC;
      prop.body.updateMassProperties();
    },
    physSpill(prop) {
      counters.spill += 1;
      prop.spilled = true;
      prop.body.type = CANNON.Body.STATIC;
      prop.body.updateMassProperties();
    },
    physGame: { state: { time: 1 }, capy: { body: capy }, events: { emit() {} } },
    physIsCapyAgent: body => body === capy,
    physStampTouch() {}, physCarriesCause: () => null, physStampVoice() {},
    physSquashHit() {}, physFlash() {}, physPersonHit() {}, physDust3() {},
    physImpactPayload: { position: new CANNON.Vec3() },
    physCV1: new CANNON.Vec3(), physCV2: new CANNON.Vec3(0, 0.5, 0),
    physIMPACT_MIN: IMPACT, physBARGE_MIN: BARGE, physBARGE_K: BARGE_K,
    physBARGE_DV: BARGE_DV, physBARGE_UP: BARGE_UP, physSHATTER_MIN: SHATTER,
    physSPILL_MIN: SPILL, physTYPES: { phobowl: { spill: false }, coffee: { spill: true } },
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  };
  return new Function('ctx', `
    const { physShatter, physSpill, physGame, physIsCapyAgent,
      physStampTouch, physCarriesCause, physStampVoice, physSquashHit,
      physFlash, physPersonHit, physDust3, physImpactPayload, physCV1,
      physCV2, physIMPACT_MIN, physBARGE_MIN, physBARGE_K, physBARGE_DV,
      physBARGE_UP, physSHATTER_MIN, physSPILL_MIN, physTYPES, clamp } = ctx;
    const physPendingImpacts = [];
    ${immediate ? 'function physQueueImpact(prop, kind) { if (kind === 2) physShatter(prop); else if (kind === 1) physSpill(prop); }' : queue}
    ${flush}
    ${collide}
    return { collide: physOnCollide, queue: physQueueImpact,
      flush: physFlushImpacts, pending: physPendingImpacts };
  `)(context);
}

function bodyWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
  world.broadphase = new CANNON.NaiveBroadphase();
  world.allowSleep = false;
  const capy = new CANNON.Body({ mass: 30, shape: new CANNON.Sphere(0.9) });
  const bowl = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.45, 0.45, 0.45)) });
  capy.position.set(0, 0, 0); capy.velocity.set(0, 6.8, 0);
  bowl.position.set(0, 0.6, 0);
  world.addBody(capy); world.addBody(bowl);
  return { world, capy, bowl };
}
function propFor(body, fragile = true, type = 'phobowl') {
  return { body, fragile, type, spilled: false, hidden: false,
    removed: false, frozen: false, held: false, tipped: false, originY: 0.45,
    homeX: body.position.x, homeZ: body.position.z, lastImpact: -Infinity,
    pendingImpact: 0 };
}
let checks = 1;
let scenarios = 0;
function eq(actual, expected, label) { checks += 1; assert.deepEqual(actual, expected, label); }
const measurements = {};

// A real Cannon contact invokes the extracted callback before solver/postStep.
scenarios += 1;
{
  const unsafe = bodyWorld();
  const unsafeCounters = { shatter: 0, spill: 0 };
  const unsafeApi = makeApi(unsafe.capy, unsafeCounters, true);
  const unsafeProp = propFor(unsafe.bowl);
  unsafe.bowl.addEventListener('collide', e => unsafeApi.collide(unsafeProp, e));
  unsafe.world.step(1 / 60);
  measurements.legacyMetres = unsafe.capy.position.length();
  assert.equal(unsafeCounters.shatter, 1, 'Cannon fixture produced no contact');
  assert.ok(Math.hypot(unsafe.capy.position.x, unsafe.capy.position.y, unsafe.capy.position.z) > 50,
    'legacy fixture did not produce unsafe displacement');

  const safe = bodyWorld();
  const counters = { shatter: 0, spill: 0 };
  const api = makeApi(safe.capy, counters);
  const prop = propFor(safe.bowl);
  let during = false;
  safe.bowl.addEventListener('collide', e => {
    api.collide(prop, e); during = safe.bowl.position.y === 0.6;
    eq(safe.bowl.type, CANNON.Body.DYNAMIC, 'contact retains dynamic body until postStep');
    eq(counters.shatter, 0, 'contact emits no early shatter');
  });
  safe.world.addEventListener('postStep', api.flush);
  safe.world.step(1 / 60);
  measurements.queuedMetres = safe.capy.position.length();
  eq(during, true, 'no body mutation during collide');
  eq(counters.shatter, 1, 'postStep shatter once');
  eq(safe.bowl.position.y, -900, 'shatter parks body after solver');
  eq(safe.bowl.type, CANNON.Body.STATIC, 'shatter freezes body after solver');
  assert.ok(Number.isFinite(safe.capy.position.x + safe.capy.position.y + safe.capy.position.z) &&
    Math.hypot(safe.capy.position.x, safe.capy.position.y, safe.capy.position.z) < 2,
    'queued contact bounds capy displacement');
  safe.world.step(1 / 60);
  eq(counters.shatter, 1, 'next solver step does not repeat destruction');
  assert.ok(safe.capy.position.length() < 2 && safe.capy.velocity.length() < 90);
}

// A spill takes the same safe boundary through the actual collision branch.
scenarios += 1;
{
  const f = bodyWorld(), counters = { shatter: 0, spill: 0 };
  const api = makeApi(f.capy, counters), prop = propFor(f.bowl, false, 'coffee');
  f.bowl.addEventListener('collide', e => {
    api.collide(prop, e);
    eq(counters.spill, 0, 'spill deferred during contact');
    eq(f.bowl.type, CANNON.Body.DYNAMIC, 'spill leaves contact body dynamic');
  });
  f.world.addEventListener('postStep', api.flush);
  f.world.step(1 / 60);
  eq(counters, { shatter: 0, spill: 1 }, 'collision branch spills after solve');
  eq(prop.spilled, true, 'spill state applied');
  eq(f.bowl.type, CANNON.Body.STATIC, 'spill freezes only after solve');
}

// Queue dedupes, shatter wins over spill, and a cleared queue accepts next contact.
scenarios += 1;
{
  const { capy, bowl } = bodyWorld();
  const counters = { shatter: 0, spill: 0 };
  const api = makeApi(capy, counters);
  const p = propFor(bowl, false, 'coffee');
  api.queue(p, 1); api.queue(p, 1); api.flush();
  eq(counters.spill, 1, 'duplicate spill once');
  const q = propFor(bowl, true);
  api.queue(q, 1); api.queue(q, 2); api.queue(q, 1); api.flush();
  eq(counters.shatter, 1, 'shatter overrides spill');
  const r = propFor(bowl, false, 'coffee');
  api.queue(r, 1); api.flush();
  eq(counters.spill, 2, 'next contact after flush');
  eq(api.pending.length, 0, 'pending queue cleared');
}

for (const field of ['removed', 'hidden']) {
  scenarios += 1;
  const f = bodyWorld(), counters = { shatter: 0, spill: 0 }, api = makeApi(f.capy, counters);
  const prop = propFor(f.bowl);
  api.queue(prop, 2); prop[field] = true; api.flush(); api.flush();
  eq(counters, { shatter: 0, spill: 0 }, field + ' prop ignored');
  eq(prop.pendingImpact, 0, field + ' pending state cleared');
  eq(api.pending.length, 0, field + ' queue drained');
}

console.log(JSON.stringify({ pass: true, scenarios, checks, measurements, cannon: 'vendor/cannon-es.js',
  scope: 'Extracted collision/queue functions; simplified bodies and declared presentation/hide/spill stubs, not a full scene replay.',
  legacyFixture: 'same collision callback with unsafe immediate mutation' }));
