// E9 actual anatomy builder, welded roots, cached cuts and unchanged flight.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from '../vendor/three.module.js';

const source = readFileSync('src/palawan.js', 'utf8');
const shared = readFileSync('src/shared.js', 'utf8');
const baseline = execFileSync('git', ['show', '55b1eeb:src/palawan.js'], { encoding: 'utf8', maxBuffer: 2000000 });
function fn(text, name) {
  const start = text.indexOf('function ' + name + '('); assert.ok(start >= 0, name + ' exists');
  return text.slice(start).match(/^function[^]*?\n\}/)[0];
}
let checks = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (v, label) => { assert.ok(v, label); checks++; };
const PALETTE = {};
for (const name of ['palWreckDk', 'palClam', 'palCaveDark'])
  PALETTE[name] = Number(shared.match(new RegExp('\\b' + name + ':\\s*(0x[0-9a-f]+)'))[1]);
const helpers = ['_mergeHash', '_mergeJitter', 'makeMerger'].map(n => fn(shared, n)).join('\n') +
  ['palXform', 'palMerger', 'palVC', 'palMantaWingGeo', 'palMantaJoin', 'palMantaLoft', 'palMantaSurface',
    'palMantaAnatomyGeo', 'palMantaContourTick'].map(n => fn(source, n)).join('\n');
const audit = source.match(/    mantaContourAudit\(\) \{[^]*?\n    \},/)[0]
  .replace('    mantaContourAudit()', 'function audit()').replace(/,$/, '');
const cuff = Number(source.match(/const palMANTA_CUFF\s*=\s*([\d.]+)/)[1]);
function fixture(text, state = {}) {
  return new Function('THREE', 'PALETTE', 'state', `
    const _mergeV=new THREE.Vector3(),_mergeNM=new THREE.Matrix3();
    const palEu=new THREE.Euler(),palQ=new THREE.Quaternion(),palV3=new THREE.Vector3(),
      palSc=new THREE.Vector3(),palM=new THREE.Matrix4(),palG={box:new THREE.BoxGeometry(1,1,1)};
    let palMantaGroup=null,palManta2Group=null,palMantaTips=null,palMantaShade=null,palMantaA=0,palMantaRideT=-1,
      palMantaContours=[],palMantaContourOn=false,palMantaSmoothOn=false,palMantaAnatomyOn=false,palMantaSmoothMat=null;
    const palMANTA_CUFF=${cuff},palGame={state};
    const cache=new Map(),mat=(color,opts)=>{const key=JSON.stringify([color,opts]);if(!cache.has(key))
      cache.set(key,new THREE.MeshLambertMaterial({color,flatShading:true,...opts}));return cache.get(key);};
    const grain=m=>m,grainOwn=m=>m.clone();
    ${helpers}${fn(text, 'palBuildManta')}${audit}
    const lofts=[],loft=palMantaLoft;
    palMantaLoft=(...args)=>{const g=loft(...args);lofts.push(g);return g;};
    const root=new THREE.Group();palBuildManta(root);
    return {root,game:palGame,rows:palMantaContours,lofts,audit,worldMaterial:palVC(),smooth:palMantaSmoothMat,
      tick:()=>palMantaContourTick(palGame),surface:palMantaSurface,rebuild:()=>palBuildManta(root)};
  `)(THREE, PALETTE, state);
}
const f = fixture(source), old = fixture(baseline, { noMantaAnatomy: true });
eq(f.rows.length, 6, 'six unchanged draw slots');
eq(f.root.children.length, old.root.children.length, 'same roots and shadow');
for (let i = 0; i < f.rows.length; i++) {
  const row = f.rows[i], prior = old.rows[i];
  for (const profile of ['base', 'live']) {
    for (const key of ['position', 'normal', 'color'])
      eq(row[profile].attributes[key].array, prior[profile].attributes[key].array, '55b1eeb ' + profile + ' byte-exact ' + key);
    eq(row[profile].index.array, prior[profile].index.array, '55b1eeb ' + profile + ' topology exact');
  }
  eq(row.mesh.position.toArray(), prior.mesh.position.toArray(), 'mesh anchor unchanged');
  eq(row.mesh.scale.toArray(), prior.mesh.scale.toArray(), 'second-animal scale unchanged');
  eq(row.mesh.parent.position.toArray(), prior.mesh.parent.position.toArray(), 'tip pivot unchanged');
  if (!row.anatomy) { ok(row.mesh.geometry === row.live, 'tips keep exact E8 geometry'); continue; }
  const geo = row.anatomy, data = geo.userData.mantaAnatomy, p = geo.attributes.position;
  for (const key of ['position', 'normal', 'color']) ok([...geo.attributes[key].array].every(Number.isFinite), 'finite anatomy ' + key);
  for (const key of ['position', 'normal', 'color']) {
    const [a, b] = data.ranges.tail;
    eq(geo.attributes[key].array.slice(a * 3, b * 3), prior.live.attributes[key].array.slice(a * 3, b * 3), 'tail attribute exact ' + key);
  }
  for (let j = data.ranges.root[0]; j < row.live.attributes.position.count; j++) {
    eq([p.getX(j), p.getY(j), p.getZ(j)], [row.live.attributes.position.getX(j), row.live.attributes.position.getY(j),
      row.live.attributes.position.getZ(j)], 'E8 wing shape unchanged');
  }
  for (const range of [data.ranges.marks, data.ranges.gills]) for (let j = range[0]; j < range[1]; j++)
    eq([p.getX(j), p.getZ(j)], [row.live.attributes.position.getX(j), row.live.attributes.position.getZ(j)], 'mark/gill footprint unchanged');
  ok(data.seat.surface <= .36 && data.seat.surface * data.seat.maxBeatScale < data.seat.y - .23,
    'ride anchor clearance at maximum inherited beat scale');
  eq([data.seat.x, data.seat.y, data.seat.z], [0, .62, -.35], 'ride anchor unchanged');
  for (const eye of data.eyes) {
    ok(Number.isFinite(eye.surface), 'eye has an actual support surface');
    ok(eye.y - .055 < eye.surface && eye.y + .055 > eye.surface + .07, 'eye embedded and exposed, not floating/buried');
    ok(Math.abs(eye.x) < .86 && eye.z < 1.78, 'eye clears wing root and cephalic fin base');
  }
  ok(Math.abs(data.eyes[0].y - data.eyes[1].y) < 1e-9, 'mirrored hull gives eyes equal support heights');
  for (const range of [data.ranges.body, data.ranges.head])
    ok(!Array.from(geo.index.array).some(v => v >= range[0] && v < range[1]), 'old trunk/head/jaw/fins do not draw');
}

function closed(geo, indices, label) {
  const p = geo.attributes.position, edges = new Map(); let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const ids = Array.from(indices.slice(i, i + 3));
    const [a, b, c] = ids.map(j => new THREE.Vector3().fromBufferAttribute(p, j));
    ok(b.clone().sub(a).cross(c.clone().sub(a)).length() > 1e-8, label + ' nondegenerate face');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], key = Math.min(a, b) + ':' + Math.max(a, b);
      const edge = edges.get(key) || { n: 0, direction: 0 };
      edge.n++; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  ok(volume > 0, label + ' outward volume');
  for (const edge of edges.values()) eq(edge, { n: 2, direction: 0 }, label + ' closed oriented edge');
}
for (const loft of f.lofts) closed(loft, loft.index.array, 'closed hull/fin loft');
const body = f.rows.find(r => r.anatomy).anatomy;
closed(body, body.userData.mantaAnatomy.coreIndex, 'welded centre and both inner wings');
const active = new Set(body.index.array), normal = body.attributes.normal;
for (const i of active) ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normal, i).length() - 1) < 1e-5, 'every active normal unit length');

for (const noMantaContour of [false, true]) for (const noMantaAnatomy of [false, true])
  for (const perfRung of [0, 1, 2]) for (const noRound of [false, true]) {
    Object.assign(f.game.state, { noMantaContour, noMantaAnatomy, perfRung, noRound }); f.tick();
    const on = !noMantaContour && perfRung < 1, anatomy = on && !noMantaAnatomy, smooth = on && !noRound;
    const a = f.audit(); eq([a.on, a.anatomy, a.smooth], [on, anatomy, smooth], 'actual gate combination');
    eq(a.mode, !on ? 'original' : anatomy ? 'anatomy' : 'contour', 'public mode exact');
    ok(a.rows.every(r => r.exact), 'all cached references exact');
    eq(f.worldMaterial.flatShading, true, 'shared world material untouched');
    for (const r of f.rows) {
      ok(r.mesh.geometry === (!on ? r.base : anatomy && r.anatomy ? r.anatomy : r.live), 'exact original/E8/E9 geometry reference');
      ok(r.mesh.material === (smooth ? f.smooth : r.material), 'same E8 material policy');
    }
    let writes = 0;
    const saved = f.rows.map(r => ['geometry', 'material'].map(key => {
      const value = r.mesh[key]; Object.defineProperty(r.mesh, key, { configurable: true, get: () => value, set: () => writes++ });
      return [key, value];
    }));
    const version = f.smooth.version;
    for (let i = 0; i < 50; i++) f.tick();
    eq(writes, 0, 'stable gate has no geometry/material writes'); eq(f.smooth.version, version, 'no stable material recompiles');
    f.rows.forEach((r, i) => saved[i].forEach(([key, value]) => Object.defineProperty(r.mesh, key,
      { value, writable: true, configurable: true, enumerable: true })));
  }
for (const state of [{}, { noMantaAnatomy: true }, { noMantaContour: true }, { perfRung: 1 }, { noRound: true }]) {
  const fresh = fixture(source, state); ok(fresh.audit().rows.every(r => r.exact), 'initial construction respects mode');
  fresh.rebuild(); ok(fresh.audit().rows.every(r => r.exact), 'private rebuild resets all cached modes');
}
for (const name of ['palMantaWingGeo', 'palMantaJoin', 'palVC', 'palMantaKey', 'palMantaRoll', 'palUpdateLeap', 'palUpdateManta'])
  eq(fn(source, name), fn(baseline, name), 'E8 skin/cuff/material/flight function unchanged: ' + name);
Object.assign(f.game.state, { noMantaContour: false, noMantaAnatomy: false, perfRung: 0, noRound: false }); f.tick();
const result = f.audit(), triangles = result.rows.reduce((n, r) => n + r.actualTriangles, 0);
eq(triangles, 1248, 'both animals remain below original1344 triangles');
eq(result.materialsAdded, 1, 'no material added beyond accepted E8');
eq(new Set(f.rows.filter(r => r.anatomy).map(r => r.anatomy)).size, 1, 'single shared anatomy body cache');
console.log(`Manta anatomy prototype: ${checks} actual-builder/weld/clearance/fallback checks passed; visual/GPU acceptance pending.`);
console.log(JSON.stringify({ triangles, cacheBytes: result.cacheBytes, body: result.rows.find(r => r.anatomy).anatomy }, null, 2));
