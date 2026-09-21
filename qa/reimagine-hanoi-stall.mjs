// REIMAGINE D: reserve the pho pavement through the existing terrace filter.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync(new URL('../src/hanoi.js', import.meta.url), 'utf8'));
let checks = 0;
const check = (ok, why) => { assert.ok(ok, why); checks++; };
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'shipped function ' + name);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escape = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = '';
    } else if ('\'"`'.includes(c)) quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error('Unclosed function ' + name);
}
function row(name) {
  const match = source.match(new RegExp('^const ' + name + '\\s*=\\s*[^;]+;', 'm'));
  assert.ok(match, 'authored row ' + name);
  return match[0];
}
const quarter = fn('hanBuildQuarter');
const reserve = quarter.match(/hanKeepOut\(11\.2,\s*15\.4,\s*6\);/g);
check(reserve?.length === 1, 'one unconditional authored stall reservation');
check(quarter.indexOf(reserve[0]) < quarter.indexOf('hanTerrace('), 'reserved before first terrace');
check(quarter.indexOf(reserve[0]) < quarter.indexOf('hanBuildBackdrop('), 'reserved before backdrop');
check(!/game\.state|no[A-Z]|save/i.test(reserve[0]), 'reservation has no flag or save dependency');
const terrace = fn('hanTerrace');
check((terrace.match(/hanTerraceOk\(/g) || []).length === 3, 'front, centre and back filtered');
check(terrace.indexOf('if (skip)') < terrace.indexOf('hanPoolBox('), 'skipped terrace never gains collider');
check(fn('hanBuildBackdrop').includes('if (!hanTerraceOk(x, z)) return false;'), 'backdrop shares clearance');

let laneDistance = 100;
const q = vm.createContext({ hanLaneAt: () => laneDistance });
vm.runInContext(['const hanKEEPOUT = [];', fn('hanKeepOut'), fn('hanTerraceOk'),
  row('hanCUB'), row('hanGROUND'), reserve[0]].join('\n'), q);
const api = vm.runInContext('({ ok: hanTerraceOk, keep: hanKeepOut, cub: hanCUB, ground: hanGROUND })', q);
const bowlCall = source.match(/game\.physics\.spawnProp\('phobowl',\s*[^;]+\)/);
check(!!bowlCall, 'actual bowl spawn exists');
q.game = { physics: { spawnProp: (...args) => args } };
const bowl = vm.runInContext(bowlCall[0], q);
check(bowl[0] === 'phobowl' && bowl[1] === 11.2 && bowl[2] === 15.4,
  'bowl authored coordinates unchanged');
check(bowl[3] === api.ground + 0.55, 'bowl authored height unchanged');
const cook = source.match(/hanLocPho\s*=\s*put\(\s*([\d.]+),\s*([\d.]+),/);
check(!!cook && +cook[1] === 12 && +cook[2] === 14, 'cook authored coordinates unchanged');
check(api.cub.x === 6 && api.cub.z === 15.5 && api.cub.yaw === 0, 'Cub authored parking unchanged');
for (const [name, x, z] of [['bowl', bowl[1], bowl[2]], ['cook', +cook[1], +cook[2]],
  ['Cub', api.cub.x, api.cub.z]]) {
  check(!api.ok(x, z), name + ' excluded from terrace sample placement');
  check(Math.hypot(x - bowl[1], z - bowl[2]) < 6, name + ' inside authored six metre reserve');
}
for (let i = 0; i < 32; i++) {
  const a = i * Math.PI / 16;
  const point = r => [bowl[1] + Math.cos(a) * r, bowl[2] + Math.sin(a) * r];
  check(!api.ok(...point(5.999)), 'disk interior rejects: ' + i);
  check(api.ok(...point(6.001)), 'disk exterior permits away from lanes: ' + i);
}
// Origin avoids floating-point cancellation at an exact radius boundary.
api.keep(100, 100, 6);
check(api.ok(106, 100), 'strict boundary preserves inherited less-than rule');
check(!api.ok(105.999, 100), 'new reserve uses inherited disk rejection');
laneDistance = 6.999;
check(!api.ok(106.001, 100), 'existing lane exclusion still wins outside disk');
laneDistance = 7;
check(api.ok(106.001, 100), 'existing seven metre lane boundary unchanged');

// Execute real quarter ordering with geometry stubs; every terrace sees reserve.
let terraces = 0, backdrops = 0;
const build = vm.createContext({
  THREE: { Mesh: class {} }, hanMerger: () => ({ build() {} }), hanPoolBody() {},
  hanInitLanes() {}, hanVCF() {}, hanPoolDone() {}, hanLaneTotal: [200, 200, 340, 200],
  hanTerrace() { terraces++; check(!build.hanTerraceOk(11.2, 15.4), 'live build terrace sees reservation'); },
  hanBuildBackdrop() { backdrops++; check(!build.hanTerraceOk(12, 14), 'live backdrop sees reservation'); },
  hanLaneAt: () => 100,
});
vm.runInContext(['const hanKEEPOUT = [];', ...['hanBIA', 'hanMARKET', 'hanBARBER', 'hanPUPPET',
  'hanTRAIN', 'hanSPAWN'].map(row), fn('hanKeepOut'), fn('hanTerraceOk'), quarter].join('\n'), build);
build.hanBuildQuarter({}, { add() {} });
check(terraces > 0 && backdrops === 1, 'actual quarter invokes terraces and backdrop');
console.log(`REIMAGINE Hanoi stall: ${checks} checks passed. Sample-point clearance, not full collider proof.`);
