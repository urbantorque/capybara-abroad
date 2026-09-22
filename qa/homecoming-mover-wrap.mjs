// Real Cannon bodies: a route seam is relocation, never solver velocity.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as CANNON from '../vendor/cannon-es.js';
import * as THREE from '../vendor/three.module.js';
const source=readFileSync('src/shared.js','utf8');
const fn=source.match(/export function makeMover\(opts\) \{[^]*?\n\}/)[0].replace('export ','');
const q=vm.createContext({});vm.runInContext(fn,q);
let checks=0;
for(const axis of ['x','z']){
  const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC});
  const group=new THREE.Group(),span=60,speed=1.5;
  const at=t=>({x:axis==='x'?-30+t*speed%span:0,z:axis==='z'?-30+t*speed%span:0,y:0,yaw:axis==='x'?Math.PI/2:0});
  const mover=q.makeMover({body,group,at,wrapSpan:span,t0:39.98});
  mover.step(.01);assert(Math.abs(body.velocity[axis]-speed)<1e-9);checks++;
  mover.step(.02);
  assert.equal(body.velocity.length(),0);checks++;
  assert(Math.abs(body.position[axis]-at(mover.t)[axis])<1e-9);checks++;
  assert(body.position.almostEquals(body.previousPosition));checks++;
  assert(body.position.almostEquals(body.interpolatedPosition));checks++;
  assert.equal(body.aabbNeedsUpdate,true);checks++;
  assert(Math.abs(group.position[axis]-body.position[axis])<1e-9);checks++;
  const before=mover.t;mover.step(0);assert.equal(mover.t,before);checks++;
  mover.step(.01);assert(Math.abs(body.velocity[axis]-speed)<1e-9);checks++;
}
for(const name of ['sahara','kyoto','rio','iceland','kowloon']){
  assert(readFileSync('src/'+name+'.js','utf8').includes('wrapSpan: span'));checks++;
}
// Undeclared routes retain their existing velocity contract.
const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC});
q.makeMover({body,at:t=>({x:t*2,z:t*3,y:t*10})}).step(.1);
assert.deepEqual(body.velocity.toArray(),[2,4,3.0000000000000004]);checks++;
console.log(checks+' mover seam checks passed');
