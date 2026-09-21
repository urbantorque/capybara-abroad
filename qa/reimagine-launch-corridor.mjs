// Offline mounting-state replay. Terrain is exact; scenery is ONLY the twelve
// authored bunting poles, not the live scanner's complete/capped obstacle table.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/condor.js'), pasto = read('../src/pasto.js'), clean = stripComments(source);
let checks = 0;
function ok(v, message) { checks++; assert.ok(v, message); }
function eq(v, want, message) { checks++; assert.equal(v, want, message); }
function number(name) {
  const m = source.match(new RegExp('const ' + name + '\\s*=\\s*([\\d.]+)'));
  ok(m, 'authored ' + name); return Number(m[1]);
}
function fn(name) {
  const start = clean.indexOf('function ' + name + '('); ok(start >= 0, 'actual ' + name);
  const open = clean.indexOf('{', start); let depth = 0;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    if (clean[i] === '}' && --depth === 0) return clean.slice(start, i + 1);
  }
  throw Error('unclosed ' + name);
}
const constants = Object.fromEntries(['condorLAUNCH_T', 'condorLAUNCH_KICK', 'condorHANG', 'condorOBS_PAD',
  'condorOBS_SLACK', 'condorOBS_STRIDE', 'condorOBS_MIN_H', 'condorOBS_MAX'].map(k => [k, number(k)]));
const terrainSource = pasto.slice(pasto.indexOf('const pastoREGION'), pasto.indexOf('const pastoCraterCentre'));
const terrain = vm.runInNewContext(terrainSource + '\npastoHeight;');
const rows = vm.runInNewContext(pasto.match(/const pastoBUNT = ([^]*?\n\]);/)[1]);
eq(rows.length, 6); eq(constants.condorOBS_STRIDE, 5);
ok(pasto.includes('pastoBodyBox(pb, px, hy * 0.5, pz, 0.11, hy * 0.5, 0.11);'), 'collider matches drawn .11m half-width');
const poles = rows.flatMap((r, row) => [0, 1].map(end => ({ row, end, x: r[end * 2], z: r[end * 2 + 1], top: r[4], half: .11 })));
const obstacles = new Float32Array(poles.flatMap(p => [p.x, p.z, p.half + constants.condorOBS_PAD,
  p.half + constants.condorOBS_PAD, p.top]));
const groundSource = fn('condorGroundTop'), pickupSource = fn('condorPickupReady');
eq((pickupSource.match(/i <= 7/g) || []).length, 1, 'one current 1.4-second endpoint');
ok(pickupSource.includes('const t = i * 0.2;'), 'authored .2-second sample cadence');
const horizons = [1.4, 1.6, 1.8, 2, constants.condorLAUNCH_T];
const vector = a => ({ x: a[0], y: a[1], z: a[2] });
function direction(q) { return [2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] ** 2 + q[1] ** 2)]; }
const heading = v => Math.atan2(v[0], v[1]) * 180 / Math.PI;
const delta = (a, b) => ((a - b + 540) % 360) - 180;
function noseInfo(state) {
  const nose = direction(state.quaternion), launch = [state.velocity[0] + nose[0] * constants.condorLAUNCH_KICK,
    state.velocity[2] + nose[1] * constants.condorLAUNCH_KICK];
  return { noseXZ: nose, noseHeading: heading(nose), postKickXZ: launch, postKickHeading: heading(launch),
    postKickMinusNoseDegrees: delta(heading(launch), heading(nose)) };
}
function run(state, horizon) {
  const queries = [], q = state.quaternion, scope = { ...constants, condorObs: obstacles, condorObsN: poles.length,
    condorBody: { position: vector(state.bird), velocity: vector(state.velocity), quaternion: { ...vector(q), w: q[3] } },
    condorTerrain: terrain };
  const ground = vm.runInNewContext('(' + groundSource + ')', scope);
  scope.condorGroundTop = (x, z) => {
    const top = ground(x, z), hits = poles.filter(p => Math.abs(x - p.x) <= Math.fround(p.half + constants.condorOBS_PAD) &&
      Math.abs(z - p.z) <= Math.fround(p.half + constants.condorOBS_PAD));
    queries.push({ t: queries.length * .2, x, z, top, poles: hits.map(p => ({ row: p.row, end: p.end, x: p.x, z: p.z, top: p.top })),
      blocks: top + constants.condorHANG + .5 >= state.bird[1] });
    return top;
  };
  const modified = pickupSource.replace('i <= 7', 'i <= ' + Math.round(horizon / .2));
  const accepted = vm.runInNewContext('(' + modified + ')', scope)();
  return { horizon, accepted, queryCount: queries.length, firstObstacleQuery: queries.find(q => q.poles.length) || null,
    firstBlockingQuery: queries.find(q => q.blocks) || null, baseGateRejected: !accepted && !queries.length,
    ...(process.argv.includes('--full') ? { queries } : {}) };
}
function continuousHit(state) {
  const { postKickXZ: velocity } = noseInfo(state), hits = [];
  for (const pole of poles) {
    if (pole.top - constants.condorOBS_SLACK + constants.condorHANG + .5 < state.bird[1]) continue;
    let enter = 0, exit = constants.condorLAUNCH_T;
    for (const [axis, centre] of [[0, pole.x], [1, pole.z]]) {
      const p = state.bird[axis === 0 ? 0 : 2], speed = velocity[axis], radius = Math.fround(pole.half + constants.condorOBS_PAD);
      if (Math.abs(speed) < 1e-12) { if (Math.abs(p - centre) > radius) exit = -1; continue; }
      const a = (centre - radius - p) / speed, b = (centre + radius - p) / speed;
      enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    }
    if (enter <= exit) hits.push({ enter, exit, pole });
  }
  return hits.sort((a, b) => a.enter - b.enter)[0] || null;
}
const synthetic = { bird: [0, 7, 17], velocity: [2, 0, 0], quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] };
eq(run(synthetic, 1.4).accepted, true, 'pole begins beyond current horizon');
eq(run(synthetic, 1.6).accepted, false, 'extended guard samples the actual pole');
eq(run(synthetic, 1.6).firstBlockingQuery.poles[0].z, 17);
// Portable before-mount facts from contact-v1 and ninth; no ignored capture
// is required to retain the two counterexamples when this file is cloned.
const fixedContact = { bird: [-.008707760063868232, 6.97274959750917, 26.907158759469386],
  velocity: [3.275758931433168, -2.328222389537135, -2.205079278195929],
  quaternion: [.3372529648412912, .8576876696729738, .2406762432613246, .3044786444503427] };
const fixedNinth = { bird: [-.3643477431856453, 7.020559251985744, 26.49757382911298],
  velocity: [3.65838672987677, -2.2607082069528506, -1.266691052601953],
  quaternion: [.31924853144472315, .8161709675488936, .26706177616460847, .40077841086128263] };
eq(run(fixedContact, 1.4).accepted, true, 'known contact pickup passes current subset guard');
eq(run(fixedContact, constants.condorLAUNCH_T).accepted, true, 'longer straight guard cannot catch turned-path contact');
eq(continuousHit(fixedContact), null, 'failure is not merely missing a discrete pole sample');
eq(run(fixedNinth, 1.4).accepted, true, 'ninth pickup passes current subset guard');
eq(run(fixedNinth, 1.6).accepted, false, 'ninth pickup intersects longer subset guard');
const report = { constants, sourceHashes: { condor: createHash('sha256').update(source).digest('hex'), pasto: createHash('sha256').update(pasto).digest('hex') },
  scope: 'Actual extracted pickup/ground-height functions and exact Pasto terrain, with twelve source-authored bunting colliders padded/slacked as the scanner does. Only loop endpoint changes. No dynamics, steering or future climb simulation. Other scenery and the live 64-shape scanner membership/order are not reconstructed. Historical recordings may predate current guard. A replay acceptance is not a safety proof; rejection may block a previously successful climbing departure.',
  files: [], skipped: [] };
for (const file of readdirSync(new URL('./', import.meta.url)).filter(f => /boarding.*\.json\.png$/.test(f))) {
  const data = JSON.parse(read('./' + file)), mounts = (data.edges || []).filter(e => e.before?.state !== 'carrying' && e.after?.state === 'carrying');
  if (!mounts.length) { report.skipped.push({ file, reason: 'No recorded before-mount edge' }); continue; }
  for (const edge of mounts) {
    const state = edge.before;
    if (!state.quaternion || !state.velocity || !state.bird) { report.skipped.push({ file, reason: 'Incomplete physical edge' }); continue; }
    const matrix = horizons.map(h => run(state, h)), initial = noseInfo(state);
    const dynamics = [.5, 1, 1.5].map(offset => {
      const row = (data.rows || []).filter(r => r.physical?.velocity && r.physical?.quaternion)
        .sort((a, b) => Math.abs(a.t - state.t - offset) - Math.abs(b.t - state.t - offset))[0];
      if (!row || Math.abs(row.t - state.t - offset) > .15) return { requestedOffset: offset, unavailable: true };
      const p = row.physical, nose = direction(p.quaternion), vxz = [p.velocity[0], p.velocity[2]];
      return { requestedOffset: offset, actualOffset: row.t - state.t, mounted: row.mounted, p: p.bird, velocityXZ: vxz,
        velocityHeading: heading(vxz), noseHeading: heading(nose), velocityMinusInitialNose: delta(heading(vxz), initial.noseHeading),
        noseMinusInitialNose: delta(heading(nose), initial.noseHeading), velocityMinusCurrentNose: delta(heading(vxz), heading(nose)), input: p.input || null };
    });
    const contact = data.contacts?.find(c => c.self === 'condor' && c.enabled && c.t >= state.t);
    const item = { file, artifactSha256: createHash('sha256').update(read('./' + file)).digest('hex'),
      recordedSignature: !!data.rows?.some(r => r.ridden), recordedFailure: data.failure || null,
      mount: state, initial, dynamics, matrix, firstContinuousBuntingHit: continuousHit(state),
      firstRejectingTestedHorizon: matrix.find(r => !r.accepted)?.horizon ?? null,
      firstContact: contact ? { offset: contact.t - state.t, p: contact.physical.bird, velocity: contact.physical.velocity,
        bodyId: contact.other.id, impact: contact.impact, shapeCount: contact.other.shapes.length } : null };
    if (file === 'reimagine-boarding-pasto-contact-v1-failure.json.png') {
      eq(contact.other.shapes.length, poles.length, 'recorded pooled body has all twelve authored posts');
      for (let i = 0; i < poles.length; i++) {
        eq(contact.other.shapes[i].offset[0], poles[i].x); eq(contact.other.shapes[i].offset[2], poles[i].z);
        eq(contact.other.shapes[i].halfExtents[1] * 2, poles[i].top);
      }
      eq(matrix[0].accepted, true, 'current bunting-only replay accepts known failed pickup');
      eq(matrix.at(-1).accepted, true, 'longest straight projection still misses later turned-path collision');
    }
    if (file === 'reimagine-journey-chain-ninth-pasto-reimagine-boarding-pasto-chain-failure.json.png') {
      eq(matrix[0].accepted, true); eq(matrix[1].accepted, false, 'ninth straight trajectory reaches pole at 1.6s');
    }
    report.files.push(item);
  }
}
report.checks = checks;
console.log(JSON.stringify(report, null, 2));
