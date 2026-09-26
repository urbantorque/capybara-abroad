// E6 prototype compatibility only. Gameplay beauty and GPU cost need a browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from '../vendor/three.module.js';
import { stripComments } from '../strip-comments.mjs';

const source = readFileSync('src/npc.js', 'utf8');
const baseline = execFileSync('git', ['show', 'f3252dd:src/npc.js'], { encoding: 'utf8', maxBuffer: 5000000 });
const top = (text, name) => text.match(new RegExp('function ' + name + '\\([^]*?\\n\\}'))[0];
const inner = (text, name) => text.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
let checks = 0;
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
function personBlock(text) {
  const start = text.indexOf('export const npcPERSON = {');
  const end = text.indexOf('export function createNPCs');
  ok(start >= 0 && end > start, 'baseline person block found, never empty');
  return text.slice(start, end);
}
equal(personBlock(source), personBlock(baseline), 'exported distant-crowd parts remain byte-exact');
equal(top(source, 'npcMakeGeo'), top(baseline, 'npcMakeGeo'), 'old geometry assembler unchanged');
equal(inner(source, 'buildHuman'), inner(baseline, 'buildHuman'), 'instanced skeleton and anchors unchanged');
const oldLocalLine = 'torsoN.add(npcLocPart(0.50, 0.62, 0.28, shirt, 0, 1.09, 0));';
const newLocalLine = "torsoN.add(npcPersonRegister(npcLocPart(0.50, 0.62, 0.28, shirt, 0, 1.09, 0), npcLocTorsoContour, 'local'));";
equal(inner(source, 'buildLocalFigure').replace(newLocalLine, oldLocalLine), inner(baseline, 'buildLocalFigure'),
  'local skeleton, collar, colours, accessories and animation anchors unchanged');
for (const pattern of [/new THREE_?\.(?:Mesh|InstancedMesh)\(/g,
  /new THREE_?\.\w*Material\(/g, /\b(?:mat|matOwn|matRound)\(/g, /\bscene\.add\(/g]) {
  // ROADMAP-TEN V2 adds ONE deliberate material door (npcSmoothOf: a smooth
  // twin of a plain flat material, cached per material), outside the contour;
  // it is taken out of the count so this still guards the contour's own code.
  const src2 = source.replace(/  function npcSmoothOf\([^]*?\n  \}/, '');
  equal(stripComments(src2).match(pattern), stripComments(baseline).match(pattern), 'no mesh/material/draw insertion: ' + pattern);
}

const torso = source.match(/  torso: \[([^]*?)\n  \],/)[1];
const sharedCall = source.match(/  const gTorsoContour = npcGarmentGeo\([^]*?\);/)[0];
const localCall = source.match(/  const npcLocTorsoContour = npcGarmentGeo\([^]*?\);/)[0];
const built = new Function('THREE', `
  const npcM1=new THREE.Matrix4(),npcE1=new THREE.Euler(),npcV1=new THREE.Vector3();
  ${top(source, 'npcSRGB')};${top(source, 'npcMakeGeo')};${top(source, 'npcGarmentGeo')};
  const npcPERSON={torso:[${torso}]};
  const gPlacket=npcMakeGeo([npcPERSON.torso[3]]);
  ${sharedCall};${localCall};
  return {shared:gTorsoContour,local:npcLocTorsoContour,inherited:npcMakeGeo(npcPERSON.torso),placket:gPlacket};
`)(THREE);

for (const [name, geometry] of Object.entries(built)) {
  for (const [key, attribute] of Object.entries(geometry.attributes)) {
    ok([...attribute.array].every(Number.isFinite), name + ' finite ' + key);
    equal(attribute.count, geometry.attributes.position.count, name + ' matched ' + key + ' vertex count');
  }
  const p = geometry.attributes.position.array, normal = geometry.attributes.normal.array;
  let volume = 0;
  const edges = new Map();
  for (let i = 0; i < p.length; i += 9) {
    const vertices = [0, 3, 6].map(k => new THREE.Vector3(p[i + k], p[i + k + 1], p[i + k + 2]));
    const [a, b, c] = vertices;
    const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    ok(cross.lengthSq() > 1e-12, name + ' nondegenerate triangle');
    const expected = cross.normalize();
    for (let k = 0; k < 9; k += 3) {
      const actual = new THREE.Vector3(normal[i + k], normal[i + k + 1], normal[i + k + 2]);
      ok(actual.dot(expected) > 0.99999, name + ' planar winding-consistent normal');
    }
    volume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    for (let j = 0; j < 3; j++) {
      const from = vertices[j].toArray().join(','), to = vertices[(j + 1) % 3].toArray().join(',');
      const key = [from, to].sort().join('|');
      const entry = edges.get(key) || { n: 0, balance: 0 };
      entry.n++; entry.balance += from < to ? 1 : -1; edges.set(key, entry);
    }
  }
  ok(volume > 0, name + ' outward signed volume');
  for (const edge of edges.values()) equal(edge, { n: 2, balance: 0 }, name + ' closed oriented edge');
  geometry.computeBoundingBox();
}
const close = (a, b, label) => ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), label);
close(built.shared.boundingBox.min.toArray(), [-0.31, 0.7145, -0.16], 'shared lower envelope');
close(built.shared.boundingBox.max.toArray(), [0.31, 1.32, 0.166], 'shared upper envelope includes old placket');
close(built.local.boundingBox.min.toArray(), [-0.25, -0.31, -0.14], 'local lower envelope');
close(built.local.boundingBox.max.toArray(), [0.25, 0.31, 0.14], 'local upper envelope');
for (const key of ['position', 'normal', 'color']) {
  const actual = built.shared.attributes[key].array, detail = built.placket.attributes[key].array;
  equal(actual.slice(actual.length - detail.length), detail, 'old placket retained exactly: ' + key);
}
equal(built.shared.attributes.position.count / 3, 72, 'shared contour triangles');
equal(built.local.attributes.position.count / 3, 60, 'local contour triangles');
equal(built.inherited.attributes.position.count / 3, 48, 'shared inherited triangles');
equal(['shared', 'local'].reduce((sum, key) => sum + Object.values(built[key].attributes)
  .reduce((n, a) => n + a.array.byteLength, 0), 0), 14256, 'two cached contour attribute buffers, bytes');

const game = { state: { noPersonContour: true, perfRung: 0 } };
const registry = new Function('game', `
  const npcPersonMeshes=[];let npcPersonOn=false;
  ${inner(source, 'npcPersonRegister')};${inner(source, 'npcPersonTick')};
  return {add:npcPersonRegister,tick:npcPersonTick};
`)(game);
function mesh() {
  const original = {}, material = {}, children = [];
  let geometry = original, writes = 0;
  return { original, material, children, userData: {}, visible: false,
    get geometry() { return geometry; }, set geometry(value) { geometry = value; writes++; },
    writes: () => writes };
}
const first = mesh(), second = mesh(), live = {};
registry.add(first, live, 'roster');
equal(first.geometry, first.original, 'register while cut preserves identical inherited buffer');
for (const mode of ['cut', 'live', 'live', 'rung', 'rung', 'live', 'cut']) {
  game.state.noPersonContour = mode === 'cut'; game.state.perfRung = mode === 'rung' ? 1 : 0;
  const before = first.writes(), old = first.geometry;
  registry.tick();
  const expected = mode === 'live' ? live : first.original;
  ok(first.geometry === expected, 'actual flag/rung switch preserves exact buffer identity: ' + mode);
  equal(first.writes() - before, old === expected ? 0 : 1, 'only edge writes geometry: ' + mode);
}
game.state.noPersonContour = false; registry.tick();
registry.add(second, live, 'local');
ok(second.geometry === live, 'lazy registered local receives active contour');
const material = second.material, children = second.children;
game.state.perfRung = 1; registry.tick();
ok(first.geometry === first.original && second.geometry === second.original, 'cut restores every registered mesh exactly');
ok(second.material === material && second.children === children, 'switch never changes material or skeleton');
equal(first.userData.personContour, true, 'audit mask tag attached');
equal(second.userData.personContour, true, 'local shares audit mask tag');
ok(source.includes('npcPersonTick();'), 'switch connected to production update');
ok(source.includes("npcPersonRegister(iTorso, gTorsoContour, 'roster');"), 'roster registered');
ok(source.includes("npcPersonRegister(pTorso, gTorsoContour, 'pasto');"), 'Pasto registered');
console.log(`Person contour prototype: ${checks} geometry, baseline and switch checks passed; visual/GPU acceptance remains unproven.`);
