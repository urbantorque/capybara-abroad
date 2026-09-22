import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync(new URL('../src/monaco.js', import.meta.url), 'utf8'));
const ride = source.indexOf('function monUpdateRide(');
assert.ok(ride >= 0, 'ride function exists');
const start = source.indexOf('if (capy.velocity)', ride);
assert.ok(start > ride, 'ride speed block exists');
const open = source.indexOf('{', start);
let depth = 0, end = -1;
for (let i = open; i < source.length; i += 1) {
  if (source[i] === '{') depth += 1;
  else if (source[i] === '}' && --depth === 0) { end = i + 1; break; }
}
assert.ok(end > start, 'ride speed block closes');
const run = new Function('capy', 'p', 'monCarG', 'monCarBody', source.slice(start, end));
let scenarios = 0, checks = 3;
function check(value, label) { checks += 1; assert.ok(value, label); }
function probe(speed, carSpeed, { angle = 0, distance = 0, swimming = false, noShove = false } = {}) {
  scenarios += 1;
  const calls = [];
  const capy = { velocity: { x: speed * Math.cos(angle), y: 2, z: speed * Math.sin(angle) }, swimming };
  if (!noShove) capy.shove = (...args) => calls.push(args);
  const before = Math.hypot(capy.velocity.x, capy.velocity.z);
  const car = { velocity: { x: carSpeed, y: 0, z: 0 } };
  run(capy, { x: 0, z: 0 }, [{ position: { x: distance, z: 0 } }], [car]);
  const after = Math.hypot(capy.velocity.x, capy.velocity.z);
  const reduced = distance < 3 && before > carSpeed + 4;
  check(after <= before + 1e-12, 'clamp never accelerates');
  check(Math.abs(after - (reduced ? carSpeed + 4 : before)) < 1e-10, 'authored ceiling or unchanged');
  check(capy.velocity.y === 2, 'vertical velocity unchanged');
  check(calls.length === (reduced && !noShove ? 1 : 0), 'shove only names a reduction');
  if (calls.length) {
    checks += 1;
    assert.deepEqual(calls[0], [0, 0, swimming ? 'the harbour' : 'the pack'], 'no added shove velocity');
  }
  if (before > 0 && after > 0) {
    check(Math.abs(capy.velocity.x / after - Math.cos(angle)) < 1e-10 &&
      Math.abs(capy.velocity.z / after - Math.sin(angle)) < 1e-10, 'direction preserved');
  }
}
for (const speed of [0, 25, 27, 27.0001, 28, 28.9999, 29, 29.0001, 40, 85]) probe(speed, 25);
probe(40, 25, { angle: 2.4 });
probe(40, 25, { swimming: true });
probe(40, 25, { noShove: true });
probe(40, 25, { distance: 3 });
probe(40, 25, { distance: 4 });
probe(10, 0);
console.log(`Monaco clamp: ${scenarios} scenarios, ${checks} checks passed`);
