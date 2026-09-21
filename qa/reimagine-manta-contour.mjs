// E8 actual builder/cache/seam checks. Visual and GPU acceptance are separate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from '../vendor/three.module.js';

const source = readFileSync('src/palawan.js', 'utf8');
const shared = readFileSync('src/shared.js', 'utf8');
const baseline = execFileSync('git', ['show', '1b367d3:src/palawan.js'], { encoding: 'utf8', maxBuffer: 2000000 });
function fn(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  return text.slice(start).match(/^function[^]*?\n\}/)[0];
}
let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const PALETTE = {};
for (const name of ['palWreckDk', 'palClam', 'palCaveDark'])
  PALETTE[name] = Number(shared.match(new RegExp('\\b' + name + ':\\s*(0x[0-9a-f]+)'))[1]);
const cuff = Number(source.match(/const palMANTA_CUFF\s*=\s*([\d.]+)/)[1]);
const helpers = ['_mergeHash', '_mergeJitter', 'makeMerger'].map(n => fn(shared, n)).join('\n') +
  ['palXform', 'palMerger', 'palVC', 'palMantaWingGeo', 'palMantaJoin', 'palMantaContourTick'].map(n => fn(source, n)).join('\n');
const audit = source.match(/    mantaContourAudit\(\) \{[^]*?\n    \},/)[0]
  .replace('    mantaContourAudit()', 'function audit()').replace(/,$/, '');

function fixture(text, flag = true, rung = 0, noRound = false) {
  return new Function('THREE', 'PALETTE', 'flag', 'rung', 'noRound', `
    const _mergeV=new THREE.Vector3(),_mergeNM=new THREE.Matrix3();
    const palEu=new THREE.Euler(),palQ=new THREE.Quaternion(),palV3=new THREE.Vector3(),
      palSc=new THREE.Vector3(),palM=new THREE.Matrix4(),palG={box:new THREE.BoxGeometry(1,1,1)};
    let palMantaGroup=null,palManta2Group=null,palMantaTips=null,palMantaShade=null,palMantaA=0,palMantaRideT=-1,
      palMantaContours=[],palMantaContourOn=false,palMantaSmoothOn=false,palMantaSmoothMat=null;
    const palMANTA_CUFF=${cuff},palGame={state:{noMantaContour:flag,perfRung:rung,noRound}};
    const cache=new Map(),mat=(color,opts)=>{const key=JSON.stringify([color,opts]);if(!cache.has(key))
      cache.set(key,new THREE.MeshLambertMaterial({color,flatShading:true,...opts}));return cache.get(key);};
    const grain=m=>m,grainOwn=m=>m.clone();
    ${helpers}${fn(text, 'palBuildManta')}${audit}
    const skins=[],join=palMantaJoin;
    palMantaJoin=(base,first,last,parts)=>{skins.push(...parts);return join(base,first,last,parts);};
    const root=new THREE.Group();palBuildManta(root);
    return {root,game:palGame,rows:palMantaContours,skins,audit,
      tick:()=>palMantaContourTick(palGame),worldMaterial:palVC(),smooth:palMantaSmoothMat,
      wing:palMantaWingGeo,rebuild:()=>palBuildManta(root)};
  `)(THREE, PALETTE, flag, rung, noRound);
}
const f = fixture(source), old = fixture(baseline);
const meshes = root => {
  const out = [];
  for (const group of root.children.filter(o => /^palManta2?$/.test(o.name)))
    group.traverse(o => { if (o.isMesh) out.push(o); });
  return out;
};
const inherited = meshes(old.root);
eq(f.rows.length, 6, 'same six manta draw slots');
eq(meshes(f.root).length, inherited.length, 'no added manta meshes');
eq(f.root.children.length, old.root.children.length, 'no added root or shadow meshes');
for (let i = 0; i < f.rows.length; i++) {
  const r = f.rows[i], original = inherited[i].geometry;
  for (const key of ['position', 'normal', 'color']) {
    eq(r.base.attributes[key].array, original.attributes[key].array, 'immutable legacy attribute: ' + key);
    eq(r.live.attributes[key].array.slice(0, original.attributes[key].array.length), original.attributes[key].array,
      'entire legacy prefix including body/details unchanged: ' + key);
    ok([...r.live.attributes[key].array].every(Number.isFinite), 'finite contour ' + key);
  }
  eq(r.base.index.array, original.index.array, 'exact inherited topology');
  const body = i % 3 === 0, first = body ? 48 : 0, last = body ? 528 : original.attributes.position.count;
  const kept = [];
  for (let j = 0; j < original.index.count; j += 3)
    if (original.index.array[j] < first || original.index.array[j] >= last)
      kept.push(...original.index.array.slice(j, j + 3));
  eq(Array.from(r.live.index.array.slice(0, kept.length)), kept, 'body/detail triangles unchanged');
  ok(!Array.from(r.live.index.array).some(v => v >= first && v < last), 'legacy slabs no longer draw live');
  eq(r.mesh.position.toArray(), inherited[i].position.toArray(), 'body/tip offset unchanged');
  eq(r.mesh.scale.toArray(), inherited[i].scale.toArray(), 'second-manta inherited scale unchanged');
  eq(r.mesh.parent.position.toArray(), inherited[i].parent.position.toArray(), 'tip pivot anchor unchanged');
}
for (const skin of f.skins) {
  const p = skin.attributes.position, n = skin.attributes.normal, indices = skin.index.array, edges = new Map();
  let volume = 0;
  for (let i = 0; i < n.count; i++) ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-6,
    'finite unit smooth normal');
  for (let i = 0; i < indices.length; i += 3) {
    const ids = Array.from(indices.slice(i, i + 3));
    const [a, b, c] = ids.map(j => new THREE.Vector3().fromBufferAttribute(p, j));
    const area = b.clone().sub(a).cross(c.clone().sub(a));
    ok(area.length() > 1e-7, 'nondegenerate skin triangle');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], key = Math.min(a, b) + ':' + Math.max(a, b);
      const row = edges.get(key) || { n: 0, direction: 0 };
      row.n++; row.direction += a < b ? 1 : -1; edges.set(key, row);
    }
  }
  ok(volume > 0, 'outward closed skin winding');
  for (const edge of edges.values()) eq(edge, { n: 2, direction: 0 }, 'closed consistently wound skin edge');
}

// Intersect the actual rotating cuff's first two rings with the fixed hinge
// plane. Its cross-section must contain every vertex of the inner wing seam.
for (const side of [-1, 1]) {
  const tip = f.skins[side < 0 ? 0 : 1], inner = f.skins[side < 0 ? 2 : 3];
  const p = tip.attributes.position, q = inner.attributes.position;
  const hinge = new THREE.Vector3(side * 2.6475, -0.203125, -0.6640625);
  const seam = Array.from({ length: 6 }, (_, j) => new THREE.Vector3().fromBufferAttribute(q, q.count - 6 + j).sub(hinge));
  for (const phase of [-0.26, -0.14, 0, 0.08, 0.30, 0.42]) {
    const angle = side * phase, rotation = new THREE.Matrix4().makeRotationZ(angle), polygon = [];
    for (let j = 0; j < 6; j++) {
      const a = new THREE.Vector3().fromBufferAttribute(p, j).applyMatrix4(rotation);
      const b = new THREE.Vector3().fromBufferAttribute(p, j + 6).applyMatrix4(rotation);
      const t = -a.x / (b.x - a.x);
      ok(t > 0 && t < 1, 'cuff spans hinge at every section vertex');
      polygon.push(a.lerp(b, t));
    }
    for (const point of seam) {
      const crosses = polygon.map((a, j) => {
        const b = polygon[(j + 1) % 6];
        return (b.y - a.y) * (point.z - a.z) - (b.z - a.z) * (point.y - a.y);
      });
      ok(crosses.every(v => v >= -1e-7) || crosses.every(v => v <= 1e-7), 'rotating cuff contains fixed seam');
    }
  }
}

for (const [flag, rung, noRound] of [[false,0,false],[false,0,true],[true,0,false],[false,1,false],[false,2,true],[false,0,false]]) {
  Object.assign(f.game.state, { noMantaContour: flag, perfRung: rung, noRound }); f.tick();
  const on = !flag && rung < 1, smooth = on && !noRound, a = f.audit();
  eq([a.on, a.smooth], [on, smooth], 'actual flag/rung/noRound gate');
  ok(a.rows.every(r => r.exact), 'exact cached geometry/material references');
  eq(f.worldMaterial.flatShading, true, 'shared world material never changes');
  for (const r of f.rows) {
    ok(r.mesh.geometry === (on ? r.live : r.base), 'exact slot geometry');
    ok(r.mesh.material === (smooth ? f.smooth : r.material), 'exact slot material');
    eq(r.mesh.material.flatShading, !smooth, 'smooth lighting respects cuts');
  }
  const versions = f.rows.map(r => r.mesh.material.version);
  let writes = 0;
  const descriptors = f.rows.map(r => ['geometry', 'material'].map(key => {
    const value = r.mesh[key];
    Object.defineProperty(r.mesh, key, { configurable: true, get: () => value, set: () => writes++ });
    return [key, value];
  }));
  for (let i = 0; i < 100; i++) f.tick();
  eq(writes, 0, 'stable gate performs zero geometry/material writes');
  eq(f.rows.map(r => r.mesh.material.version), versions, 'stable gate never requests material compile');
  f.rows.forEach((r, i) => descriptors[i].forEach(([key, value]) =>
    Object.defineProperty(r.mesh, key, { value, writable: true, enumerable: true, configurable: true })));
}
for (const mode of [[false,0,false],[false,1,false],[false,0,true]]) {
  const created = fixture(source, ...mode), a = created.audit();
  eq([a.on, a.smooth], [!mode[0] && mode[1] < 1, !mode[0] && mode[1] < 1 && !mode[2]], 'first construction gate');
  ok(a.rows.every(r => r.exact), 'initial cached references exact');
  created.rebuild();ok(created.audit().rows.every(r => r.exact), 'private rebuild resets cache latch');
}
for (const name of ['palMantaKey', 'palMantaRoll', 'palUpdateLeap'])
  eq(fn(source, name), fn(baseline, name), 'ride/timing function untouched: ' + name);
eq(fn(source, 'palUpdateManta').replace('  palMantaContourTick(game);\n', ''), fn(baseline, 'palUpdateManta'),
  'all actual route, animation, physics, mount, reward and release code unchanged');
eq(fn(source, 'palVC').replace('function palVC(own)', 'function palVC()').replace('(own ? grainOwn : grain)', 'grain'),
  fn(baseline, 'palVC'), 'private variant preserves every inherited grain/material row');
const a = f.audit();
eq(a.rows.reduce((n, r) => n + r.inheritedTriangles, 0), 1344, 'inherited two-animal triangle count');
eq(a.rows.reduce((n, r) => n + r.contourTriangles, 0), 1072, 'live two-animal triangle count');
eq(new Set(a.rows.map(r => r.liveUuid)).size, 3, 'three shared cached live geometries');
eq(a.materialsAdded, 1, 'one private cached material variant');
ok(a.seam.margin > .065, 'cuff overlap reserve at maximum inherited curl');
console.log(`Manta contour prototype: ${checks} actual-builder/cache/seam checks passed; visual/GPU acceptance remains unproven.`);
console.log(JSON.stringify({ cacheBytes: a.cacheBytes, seam: a.seam, rows: a.rows.map(r => ({ root: r.rootName,
  inheritedTriangles: r.inheritedTriangles, contourTriangles: r.contourTriangles,
  baseVertices: r.baseVertices, contourVertices: r.contourVertices })) }, null, 2));
