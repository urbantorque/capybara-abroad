// E10 isolated geometry study. No production import, browser or acceptance claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from '../vendor/three.module.js';

const source = execFileSync('git', ['show', '02243fd:src/pasto.js'], { encoding: 'utf8', maxBuffer: 2000000 });
const shared = readFileSync('src/shared.js', 'utf8');
function fn(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const line = text.slice(start).split(/\r?\n/)[0];
  if (line.endsWith('}')) return line;
  return text.slice(start).match(/^function[^]*?\n\}/)[0];
}
let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const PALETTE = {};
for (const name of ['peakFar', 'volcanoSnow'])
  PALETTE[name] = Number(shared.match(new RegExp('\\b' + name + ':\\s*(0x[0-9a-f]+)'))[1]);

// Candidate helpers begin. Their only dependencies are THREE, PALETTE and the
// existing pastoMerge; integration copies these functions, never imports QA.
function pastoAndesRidge(sides) {
  const points = [], indices = [];
  for (let j = 0; j < sides; j++) {
    const a = j / sides * Math.PI * 2;
    points.push(Math.sin(a), -.5, Math.cos(a));
  }
  for (let j = 0; j < sides; j++) {
    const a = j / sides * Math.PI * 2;
    // Incise the straight flank. This ring stays inside the inherited cone;
    // the unequal heights make a shoulder rather than a horizontal stripe.
    const t = .50 + .075 * Math.cos(a + .65), r = (1 - t) * .78;
    points.push(Math.sin(a) * r, t - .5, Math.cos(a) * r);
  }
  const high = sides * 2, low = high + 1, bottom = high + 2;
  points.push(0, .5, 0, -.105, .32, 0, 0, -.5, 0);
  const tri = (a, b, c) => indices.push(a, b, c);
  const owner = j => j <= Math.floor(sides / 2) ? high : low;
  for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides, a = sides + j, b = sides + k;
    tri(bottom, k, j);
    tri(j, k, b); tri(j, b, a);
    tri(a, b, owner(k));
    if (owner(j) !== owner(k)) tri(a, owner(k), owner(j));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}

function pastoAndesSnow(parent, from) {
  const p = parent.attributes.position, idx = parent.index.array, positions = [];
  const plane = from - .5;
  for (let i = 0; i < idx.length; i += 3) {
    let polygon = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, idx[i + j]));
    const clipped = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j], b = polygon[(j + 1) % polygon.length];
      const ia = a.y >= plane, ib = b.y >= plane;
      if (ia) clipped.push(a);
      if (ia !== ib) clipped.push(a.clone().lerp(b, (plane - a.y) / (b.y - a.y)));
    }
    polygon = clipped;
    for (let j = 1; j + 1 < polygon.length; j++) {
      const tri = [polygon[0], polygon[j], polygon[j + 1]];
      if (tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).lengthSq() < 1e-18) continue;
      // Radial separation cannot raise the summit. The uncapped skin follows
      // the actual supporting triangles, including both ends of the ridge.
      for (const v of tri) positions.push(v.x * 1.0002, v.y, v.z * 1.0002);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}

function pastoAndesGeometry(parts, merge) {
  const live = [], audit = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i], m = part.m.elements;
    if (part.c !== PALETTE.volcanoSnow) {
      const g = pastoAndesRidge(part.g.parameters.radialSegments);
      live.push({ ...part, g });
      audit.push({ kind: 'ridge', parent: i, from: 0 });
      continue;
    }
    // Match the authored cap to its own parent/shoulder by the unchanged
    // centre. In the original order a parent's cap follows its shoulder.
    let parent = -1;
    for (let j = i - 1; j >= 0; j--) {
      const b = parts[j].m.elements;
      if (parts[j].c !== PALETTE.volcanoSnow && Math.abs(m[12] - b[12]) < 1e-7 && Math.abs(m[14] - b[14]) < 1e-7) {
        parent = j; break;
      }
    }
    if (parent < 0) throw new Error('Pasto snow cap has no supporting ridge');
    const inv = parts[parent].m.clone().invert();
    const foot = new THREE.Vector3(0, -.5, 0).applyMatrix4(part.m).applyMatrix4(inv);
    const from = foot.y + .5;
    live.push({ ...part, g: pastoAndesSnow(live[parent].g, from), m: parts[parent].m });
    audit.push({ kind: 'snow', parent, from });
  }
  const geometry = merge(live);
  return { geometry, parts: live, audit };
}
// Candidate helpers end.

const rows = source.match(/const pastoPEAK_RINGS = \[[^]*?\n\];/)[0];
const helperNames = ['pastoRnd', 'pastoRndR', 'pastoUnbase', 'pastoMerge', 'pastoXf', 'pastoBuildFarPeaks'];
function fixture(seed) {
  return new Function('THREE', 'PALETTE', 'seed', `
    let pastoSeed=seed, captured=null;
    const pastoBASE=new THREE.Color(PALETTE.volcanoSnow),pastoTmpCol=new THREE.Color(),
      pastoEul=new THREE.Euler(),pastoQuat=new THREE.Quaternion(),pastoVecA=new THREE.Vector3(),pastoVecB=new THREE.Vector3();
    const mat=(color,options)=>new THREE.MeshLambertMaterial({color,flatShading:true,...options});
    ${rows}${helperNames.map(n => fn(source, n)).join('\n')}
    const actualMerge=pastoMerge;
    pastoMerge=parts=>{captured=parts;return actualMerge(parts);};
    const mesh=pastoBuildFarPeaks();
    return {mesh,parts:captured,seed:()=>pastoSeed,merge:actualMerge};
  `)(THREE, PALETTE, seed);
}

function closed(geometry, label) {
  const indices = geometry.index.array, edges = new Map();
  const p = geometry.attributes.position, a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    a3.fromBufferAttribute(p, indices[i]); b3.fromBufferAttribute(p, indices[i + 1]); c3.fromBufferAttribute(p, indices[i + 2]);
    ok(b3.clone().sub(a3).cross(c3.clone().sub(a3)).lengthSq() > 1e-12, label + ' no degenerate triangles');
    volume += a3.dot(b3.clone().cross(c3)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = indices[i + j], b = indices[i + (j + 1) % 3];
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      const row = edges.get(key) || { count: 0, direction: 0 };
      row.count++; row.direction += a < b ? 1 : -1; edges.set(key, row);
    }
  }
  for (const row of edges.values()) {
    eq(row.count, 2, label + ' closed edge'); eq(row.direction, 0, label + ' outward shared winding');
  }
  ok(volume > 0, label + ' positive signed volume/outward orientation');
}

let report, allSnowGap = 0, allSnowGapWorld = 0;
for (const seed of [0x9e3779b9 | 0, 42, -732]) {
  const original = fixture(seed), again = fixture(seed);
  const seedAfter = original.seed(), snapshot = original.parts.map(p => ({ c: p.c, gain: p.gain, matrix: p.m.toArray() }));
  const candidate = pastoAndesGeometry(original.parts, original.merge);
  eq(original.seed(), seedAfter, 'candidate consumes no random values');
  eq(snapshot, original.parts.map(p => ({ c: p.c, gain: p.gain, matrix: p.m.toArray() })), 'authored rows/transforms unchanged');
  for (const key of ['position', 'normal', 'color']) {
    eq(original.mesh.geometry.attributes[key].array, again.mesh.geometry.attributes[key].array, 'original assembly deterministic/exact ' + key);
    ok([...candidate.geometry.attributes[key].array].every(Number.isFinite), 'finite live ' + key);
  }
  eq(original.parts.length, 41, 'original 33 mountains and eight caps');
  eq(original.mesh.geometry.attributes.position.count / 3, 376, 'actual inherited triangles');
  eq(candidate.parts.length, original.parts.length, 'same palette parts');
  const closest = new THREE.Vector3(), triangle = new THREE.Triangle();
  let maxSnowGap = 0, maxSnowGapWorld = 0, snow = 0;
  for (let i = 0; i < candidate.parts.length; i++) {
    const part = candidate.parts[i], row = candidate.audit[i], p = part.g.attributes.position;
    eq(part.c, original.parts[i].c, 'palette entry exact'); eq(part.gain, original.parts[i].gain, 'authored gain exact');
    if (row.kind === 'ridge') {
      closed(part.g, 'ridge ' + i);
      eq(part.m, original.parts[i].m, 'ridge transform identity');
      eq(part.g.boundingBox.min.y, -.5, 'buried base exact'); eq(part.g.boundingBox.max.y, .5, 'summit height exact');
      const sides = original.parts[i].g.parameters.radialSegments;
      for (let j = 0; j < p.count; j++) {
        const t = p.getY(j) + .5;
        ok(t >= 0 && t <= 1, 'ridge within original vertical envelope');
        // Each old polygon side defines a half-space. Every candidate vertex
        // stays inside the old cone, so it cannot close previously open sky.
        for (let k = 0; k < sides; k++) {
          const a = (k + .5) / sides * Math.PI * 2;
          ok(p.getX(j) * Math.sin(a) + p.getZ(j) * Math.cos(a) <= (1 - t) * Math.cos(Math.PI / sides) + 1e-7,
            'ridge contained in old polygon cone');
        }
      }
    } else {
      snow++;
      const parent = candidate.parts[row.parent].g, pp = parent.attributes.position, pi = parent.index.array;
      ok(Math.abs(row.from - .70) < 1e-8 || Math.abs(row.from - .76) < 1e-8, 'authored snow base derived from actual matrix');
      // A supported patch must also face out under the inherited FrontSide
      // material. Check the clipped winding against its nearest parent face.
      for (let j = 0; j < p.count; j += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(p, j);
        const b = new THREE.Vector3().fromBufferAttribute(p, j + 1);
        const c = new THREE.Vector3().fromBufferAttribute(p, j + 2);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        ok(normal.lengthSq() > 1e-18, 'snow triangle nondegenerate');
        normal.normalize();
        const centre = a.clone().add(b).add(c).multiplyScalar(1 / 3);
        let nearest = Infinity, facing = null;
        for (let k = 0; k < pi.length; k += 3) {
          triangle.a.fromBufferAttribute(pp, pi[k]); triangle.b.fromBufferAttribute(pp, pi[k + 1]); triangle.c.fromBufferAttribute(pp, pi[k + 2]);
          triangle.closestPointToPoint(centre, closest);
          const distance = closest.distanceToSquared(centre);
          if (distance < nearest) {
            nearest = distance;
            facing = triangle.getNormal(new THREE.Vector3()).dot(normal);
          }
        }
        ok(facing > .9999, 'snow winding matches supporting parent face');
      }
      for (let j = 0; j < p.count; j++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, j); let distance = Infinity;
        for (let k = 0; k < pi.length; k += 3) {
          triangle.a.fromBufferAttribute(pp, pi[k]); triangle.b.fromBufferAttribute(pp, pi[k + 1]); triangle.c.fromBufferAttribute(pp, pi[k + 2]);
          triangle.closestPointToPoint(v, closest); distance = Math.min(distance, closest.distanceTo(v));
        }
        maxSnowGap = Math.max(maxSnowGap, distance);
        ok(distance <= .0001, 'snow is supported by an actual parent triangle');
        ok(v.y >= row.from - .5 - 1e-7 && v.y <= .5, 'snow stays within derived band and summit');
        const world = v.clone().applyMatrix4(part.m); let worldDistance = Infinity;
        for (let k = 0; k < pi.length; k += 3) {
          triangle.a.fromBufferAttribute(pp, pi[k]).applyMatrix4(part.m);
          triangle.b.fromBufferAttribute(pp, pi[k + 1]).applyMatrix4(part.m);
          triangle.c.fromBufferAttribute(pp, pi[k + 2]).applyMatrix4(part.m);
          triangle.closestPointToPoint(world, closest); worldDistance = Math.min(worldDistance, closest.distanceTo(world));
        }
        maxSnowGapWorld = Math.max(maxSnowGapWorld, worldDistance);
        ok(worldDistance <= .005, 'actual world-space snow separation below five millimetres');
      }
    }
  }
  eq(snow, 8, 'eight actual surface skins');
  const triangles = candidate.geometry.attributes.position.count / 3;
  const bytes = Object.values(candidate.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0);
  ok(triangles <= 900, 'bounded triangle budget'); ok(bytes <= 100 * 1024, 'bounded added cache');
  eq(original.mesh.material.flatShading, true, 'same flat Lambert material');
  for (let i = 0; i < candidate.geometry.attributes.normal.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(candidate.geometry.attributes.normal, i);
    ok(Math.abs(n.length() - 1) < 1e-5, 'finite unit flat normal after actual merger');
  }
  allSnowGap = Math.max(allSnowGap, maxSnowGap); allSnowGapWorld = Math.max(allSnowGapWorld, maxSnowGapWorld);
  report = { checks, inheritedTriangles: 376, liveTriangles: triangles, vertices: triangles * 3,
    addedCacheBytes: bytes, drawCalls: 1, snowSkins: snow, maxSnowGapLocal: allSnowGap, maxSnowGapWorld: allSnowGapWorld,
    scope: 'Isolated geometry candidate, actual extracted old assembly. No production/browser/visual acceptance.' };
  for (const part of candidate.parts) part.g.dispose();
  candidate.geometry.dispose(); original.mesh.geometry.dispose(); original.mesh.material.dispose();
  again.mesh.geometry.dispose(); again.mesh.material.dispose();
}
console.log(JSON.stringify(report, null, 2));
