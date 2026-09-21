// E7 actual merger/builder checks. Static compatibility is not visual acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from '../vendor/three.module.js';
import { stripComments } from '../strip-comments.mjs';

const source = readFileSync('src/kyoto.js', 'utf8');
const shared = readFileSync('src/shared.js', 'utf8');
const baseline = execFileSync('git', ['show', 'f3252dd:src/kyoto.js'], { encoding: 'utf8', maxBuffer: 2000000 });
function fn(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function exists: ' + name);
  return text.slice(start).match(/^function[^]*?\n\}/)[0];
}
let checks = 0;
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
const PALETTE = {};
for (const name of ['granite', 'graniteDark', 'ujiFoam'])
  PALETTE[name] = Number(shared.match(new RegExp('\\b' + name + ':\\s*(0x[0-9a-f]+)'))[1]);
const helpers = ['_mergeHash', '_mergeJitter', 'makeMerger'].map(n => fn(shared, n)).join('\n') +
  ['kyoXform', 'kyoInitGeos', 'kyoMerger', 'kyoChuteBuffers', 'kyoUpdateChute'].map(n => fn(source, n)).join('\n');
const riverY = Number(source.match(/const kyoRIVER_Y\s*=\s*([\d.-]+)/)[1]);
const chuteAt = Number(source.match(/const kyoCHUTE_AT\s*=\s*([\d.]+)/)[1]);

// Straight synthetic reaches exercise three headings and widths. The geometry
// builder, primitive merger, transforms and cache writer are the shipped code.
function fixture(text, angle, width, mode = 'flag') {
  return new Function('THREE', 'PALETTE', 'angle', 'width', 'mode', `
    const _mergeV=new THREE.Vector3(),_mergeNM=new THREE.Matrix3();
    const kyoEu=new THREE.Euler(),kyoQ=new THREE.Quaternion(),kyoV3=new THREE.Vector3(),
      kyoSc=new THREE.Vector3(),kyoM=new THREE.Matrix4(),kyoG={box:null};
    const kyoRIVER_Y=${riverY},kyoCHUTE_AT=${chuteAt},kyoRunAt=f=>f*215,
      kyoRiverSeg=s=>({x:s,z:0,tx:Math.sin(angle),tz:Math.cos(angle),w:width});
    let kyoRocks=[],kyoChuteS=-1,kyoChuteMesh=null,kyoChuteBase=null,kyoChuteLive=null,
      kyoChuteRange=null,kyoChuteOn=false;
    const bodies=[],kyoStaticBox=(...a)=>bodies.push(a.slice(1)),kyoVC=()=>new THREE.MeshLambertMaterial();
    ${helpers}${fn(text, 'kyoBuildRocks')}
    let parts=[];const cacheBuilder=kyoChuteBuffers;
    kyoChuteBuffers=(geometry,rows)=>{parts=rows;return cacheBuilder(geometry,rows);};
    kyoInitGeos();const root=new THREE.Group(),game={state:{noChuteContour:mode==='flag',perfRung:mode==='rung'?1:0}};
    kyoBuildRocks(game,root);
    return {root,game,bodies,tick:()=>kyoUpdateChute(game),
      state:()=>({on:kyoChuteOn,range:kyoChuteRange,base:kyoChuteBase,live:kyoChuteLive}),
      parts:()=>parts,axis:row=>new THREE.Vector3(1,0,0).transformDirection(kyoXform(...row.to)),
      rebuild:()=>kyoBuildRocks(game,root)};
  `)(THREE, PALETTE, angle, width, mode);
}

for (const name of ['kyoBuildRiverPath', 'kyoRiverNear', 'kyoRiverCut', 'kyoRiverSeg',
  'kyoUpdateRun', 'kyoBuildFoam', 'kyoUpdateFoam']) {
  equal(fn(source, name), fn(baseline, name), 'physics/flow/trail writer unchanged: ' + name);
}
for (const pattern of [/new THREE\.(?:Mesh|InstancedMesh)\(/g, /\bkyoVC\(/g])
  equal(stripComments(source).match(pattern), stripComments(baseline).match(pattern), 'no new draw/material construction');

for (const angle of [0, 0.67, Math.PI / 2]) for (const width of [5.5, 12, 15]) {
  const f = fixture(source, angle, width), old = fixture(baseline, angle, width);
  const mesh = f.root.children[0], g = mesh.geometry, og = old.root.children[0].geometry;
  const material = mesh.material, attributes = { position: g.attributes.position, normal: g.attributes.normal };
  for (const key of ['position', 'normal', 'color']) equal(g.attributes[key].array, og.attributes[key].array, 'initial flag cut matches f3252dd: ' + key);
  equal(g.index.array, og.index.array, 'triangle topology exact');
  equal(f.bodies, old.bodies, 'colliders exact');
  equal(f.root.children.length, old.root.children.length, 'same mesh count');
  const { range, base, live } = f.state();
  equal(range, { start: 3612, count: 177, indexStart: 10080, indexCount: 432 }, 'only six crest primitives marked');
  equal(mesh.userData.chuteContourRange, range, 'narrow harness marker');
  equal(g.index.count / 3, 3684, 'whole rock batch triangle count');
  equal(base.position.byteLength + base.normal.byteLength + live.position.byteLength + live.normal.byteLength, 8496, 'range-only cache bytes');
  const start = range.start * 3, end = (range.start + range.count) * 3;
  f.game.state.noChuteContour = false; f.tick();
  ok(f.state().on, 'live profile enabled');
  // The patch's long axis is local X, not local Z. Check the actual authored
  // transform and the uploaded equatorial diameter against the river tangent.
  const flow = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  for (const patch of f.parts().filter((_, i) => i % 2 === 1)) {
    ok(patch.from[6] > patch.from[8], 'inherited patch long axis is X at width ' + width);
    ok(patch.to[6] > patch.to[8], 'live patch long axis stays X at width ' + width);
    ok(f.axis(patch).dot(flow) > 1 - 1e-12, 'actual live transform maps X along flow');
    const p = g.attributes.position, b = og.attributes.position;
    let lo = patch.range[0], hi = lo;
    for (let i = lo + 1; i < patch.range[1]; i++) {
      if (b.getX(i) < b.getX(lo)) lo = i;
      if (b.getX(i) > b.getX(hi)) hi = i;
    }
    const diameter = new THREE.Vector3(p.getX(hi) - p.getX(lo), p.getY(hi) - p.getY(lo),
      p.getZ(hi) - p.getZ(lo)).normalize();
    ok(diameter.dot(flow) > 1 - 1e-8, 'actual merged patch diameter follows current');
  }
  let moved = 0, minY = Infinity, maxY = -Infinity;
  for (const key of ['position', 'normal']) {
    const attr = g.attributes[key], oldArray = og.attributes[key].array;
    ok(attr === attributes[key], 'cached range upload retains attribute object');
    ok([...attr.array].every(Number.isFinite), 'finite live ' + key);
    equal(attr.array.slice(0, start), oldArray.slice(0, start), 'upstream rocks untouched: ' + key);
    equal(attr.array.slice(end), oldArray.slice(end), 'five downstream patches untouched: ' + key);
    equal(attr.updateRanges, [{ start, count: range.count * 3 }], 'only selected components queued for upload');
  }
  equal(g.attributes.color.array, og.attributes.color.array, 'live palette/jitter exact');
  equal(g.index.array, og.index.array, 'live topology exact');
  ok(mesh.material === material, 'live material identity retained');
  for (let i = range.start; i < range.start + range.count; i++) {
    const p = g.attributes.position, b = og.attributes.position;
    if (p.getX(i) !== b.getX(i) || p.getY(i) !== b.getY(i) || p.getZ(i) !== b.getZ(i)) moved++;
    minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i));
  }
  ok(moved > 150, 'structural crest contribution');
  ok(minY >= riverY - 1e-5 && maxY <= riverY + 0.16001, 'low crest envelope above water');
  for (const mode of ['live', 'flag', 'flag', 'live', 'rung', 'rung', 'live']) {
    const oldOn = f.state().on, pv = g.attributes.position.version, nv = g.attributes.normal.version;
    f.game.state.noChuteContour = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0;
    f.tick(); const on = mode === 'live';
    equal(f.state().on, on, 'actual edge gate: ' + mode);
    equal(g.attributes.position.version - pv, oldOn === on ? 0 : 1, 'position writes only on edges');
    equal(g.attributes.normal.version - nv, oldOn === on ? 0 : 1, 'normal writes only on edges');
    if (!on) for (const key of ['position', 'normal'])
      equal(g.attributes[key].array, og.attributes[key].array, 'exact inherited restoration: ' + mode + '/' + key);
  }
}
for (const mode of ['live', 'rung']) {
  const f = fixture(source, 0.67, 12, mode), g = f.root.children[0].geometry, state = f.state();
  equal(state.on, mode === 'live', 'construction respects initial ' + mode);
  const profile = mode === 'live' ? state.live : state.base;
  for (const key of ['position', 'normal']) equal(g.attributes[key].array.slice(state.range.start * 3,
    (state.range.start + state.range.count) * 3), profile[key], 'initial profile already installed');
}

// The real chapter builder is one-shot. A direct second call to the private
// rocks builder bypasses that contract; report its cache latch separately.
ok(/^function kyoBuild\(game\)\s*\{\s*if \(kyoBuilt\) return;\s*kyoBuilt = true;/.test(fn(source, 'kyoBuild')),
  'production builder guards repeated construction');
equal((stripComments(source).match(/kyoBuilt\s*=\s*false/g) || []).length, 1, 'no production reset path');
const repeated = fixture(source, 0.67, 12, 'live'); repeated.rebuild();
const second = repeated.root.children[1].geometry, repeatedState = repeated.state();
const repeatedMatchesLive = second.attributes.position.array.slice(repeatedState.range.start * 3,
  (repeatedState.range.start + repeatedState.range.count) * 3).every((v, i) => v === repeatedState.live.position[i]);
console.log(`Chute contour prototype: ${checks} actual-builder/cache/physics checks passed; visual/GPU acceptance remains unproven.`);
console.log(`Unsupported direct rocks rebuild: active profile installed=${repeatedMatchesLive}; production kyoBuilt guard prevents this path.`);
