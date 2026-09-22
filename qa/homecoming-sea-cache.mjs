// Deterministic proof for Monaco's shipped sea cache/write path. No browser
// or renderer: execute the actual extracted helpers on the real sea lattice.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/monaco.js', 'utf8');
function fn(name) {
  const at = source.indexOf('function ' + name + '(');
  assert(at >= 0, name);
  const start = source.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  throw Error('Unclosed ' + name);
}

const port = vm.runInNewContext('(' + source.match(/const monPORT\s*=\s*(\{[^}]+\})/)[1] + ')');
const water = Number(source.match(/const monWATER\s*=\s*(-?[0-9.]+)/)?.[1]);
assert(Number.isFinite(water));
const q = vm.createContext({ Math, Float32Array, Float64Array, monPORT: port });
vm.runInContext([fn('monSeaBuildCache'), fn('monSeaWrite')].join('\n'), q);
const uq = vm.createContext({ Math, Float32Array, Float64Array });
vm.runInContext(`let monSeaAttr = null, monSeaBase = null, monSeaSinA = null, monSeaCosA = null,
  monSeaSinB = null, monSeaCosB = null, monSeaSinC = null, monSeaCosC = null, monTime = 0;
const monWATER = ${water};
${fn('monSeaWrite')}
${fn('monUpdateSea')}
globalThis.install = (attr, cache, t) => {
  monSeaAttr = attr; monSeaBase = cache.base; monSeaSinA = cache.sinA; monSeaCosA = cache.cosA;
  monSeaSinB = cache.sinB; monSeaCosB = cache.cosB; monSeaSinC = cache.sinC; monSeaCosC = cache.cosC; monTime = t;
};
globalThis.clear = () => { monSeaAttr = null; };
globalThis.run = () => monUpdateSea(0);`, uq);

const bounds = vm.runInNewContext(source.match(/const monSEA_X0[^;]+;/)[0] +
  '; [monSEA_X0,monSEA_X1,monSEA_Z0,monSEA_Z1]');
const segments = fn('monBuildSea').match(/new THREE\.PlaneGeometry\([^\n]+, (\d+), (\d+)\)/);
const NX = Number(segments[1]), NZ = Number(segments[2]);
const X0 = bounds[0], Z0 = bounds[2], W = bounds[1]-X0, H = bounds[3]-Z0;
const edge = [-44 - 1e-6, -44, -44 + 1e-6, 46 - 1e-6, 46, 46 + 1e-6,
  -80 - 1e-6, -80, -80 + 1e-6, -8 - 1e-6, -8, -8 + 1e-6];
const points = [];
for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++)
  points.push([X0 + i * W / NX, Z0 + j * H / NZ]);
for (const x of edge) for (const z of edge) points.push([x, z]);
const p = new Float32Array(points.length * 3);
for (let k = 0; k < points.length; k++) {
  p[k * 3] = points[k][0]; p[k * 3 + 2] = points[k][1];
}
const cache = q.monSeaBuildCache(p);
const cacheAgain = q.monSeaBuildCache(p);
assert.notEqual(cache.base, cacheAgain.base, 'cache rebuild must allocate fresh arrays');
assert.equal(cache.base.length, points.length);

const times = [-1e6, -1000, -17.25, 0, 0.123, 1.5, 17.25, 1000, 1e6];
const original = (t, x, z, inPort) => water + (inPort
  ? Math.sin(t * 1.35 + x * 0.14 + z * 0.09) * 0.035
  : Math.sin(t * 0.62 + (x * 0.62 + z * 0.78) * 0.021) * 0.46
    + Math.sin(t * 1.05 - (x * 0.30 - z * 0.95) * 0.048) * 0.17);
let maxError = 0, checks = 0;
for (const t of times) {
  const out = new Float32Array(p);
  const before = new Float32Array(out);
  const attr = { array: out, needsUpdate: false };
  uq.install(attr, cache, t);
  uq.run();
  assert.equal(attr.needsUpdate, true, 'write marks position attribute dirty');
  for (let k = 0; k < points.length; k++) {
    const i = k * 3;
    const x = out[i], z = out[i + 2];
    const inPort = x > -44 && x < 46 && z > -80 && z < -8;
    const expected = original(t, x, z, inPort);
    assert.equal(out[i], before[i], 'x changed');
    assert.equal(out[i + 2], before[i + 2], 'z changed');
    const error = Math.abs(out[i + 1] - expected);
    maxError = Math.max(maxError, error);
    assert(error < 1e-6, 'cached Float32 height mismatch');
    checks++;
  }
}
const untouched = { array: new Float32Array(3), needsUpdate: false };
uq.clear();
uq.run();
uq.install(untouched, { base: null }, 0);
uq.run();
assert.equal(untouched.needsUpdate, false, 'missing cache leaves attribute untouched');
assert(source.includes('const cache = monSeaBuildCache(p);'), 'build wires cache creation');
assert(source.includes('monSeaBase = cache.base;'), 'build overwrites cache state');
console.log(JSON.stringify({ pass: true, checks, points: points.length, times: times.length,
  maxError, longTimes: true, missingAttr: true, cacheRebuild: true }));
