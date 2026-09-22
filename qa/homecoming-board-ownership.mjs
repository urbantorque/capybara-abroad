// Shipped ornament lifecycle against the real Object3D add/remove semantics.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
const source=readFileSync('src/systems.js','utf8');
const plant=source.match(/  function boardHangPlant\(bio\) \{[^]*?\n  \}/)[0];
const drop=source.match(/  function boardHangDrop\(\) \{[^]*?\n  \}/)[0];
const rows=source.match(/  const sysBOARD_HANG = \{[^]*?\n  \};/)[0];
const loose='THREE.Object3D.prototype.add.call(scene, g);';assert(plant.includes(loose));
function run(builder,expectedCapture){
  const scene=new THREE.Scene(),captured=[],records=new Set();let disposed=0;
  scene.add=function(o){captured.push(o);return THREE.Object3D.prototype.add.call(this,o);};
  const material=new THREE.MeshLambertMaterial();
  const q=vm.createContext({THREE,scene,sysBOARD_DRESS:{},sysBOARD_DEF:{trim:1,wood:1,woodDk:1},
    boardObj:{hx:1,topY:2},boardYaw:0,boardX:0,boardZ:1,boardY:0,
    game:{hang:r=>{records.add(r);return r;},hangRemove:r=>records.delete(r)},
    hangThing:()=>{const g=new THREE.Group(),geo=new THREE.BoxGeometry(.1,.1,.1);
      geo.addEventListener('dispose',()=>disposed++);g.add(new THREE.Mesh(geo,material));return g;}});
  vm.runInContext('let boardHangG=null,boardHangRec=null;'+rows+builder+drop,q);
  for(let i=0;i<6;i++){
    q.biome=i%2?'hanoi':'sydney';vm.runInContext('boardHangPlant(biome)',q);
    assert.equal(scene.children.length,1);assert.equal(records.size,1);
    const record=[...records][0];assert.equal(record.biome,q.biome);
    assert(Math.abs(scene.children[0].position.x-.86)<1e-9);
    assert(Math.abs(scene.children[0].position.z-1.45)<1e-9);
    vm.runInContext('boardHangDrop()',q);
    assert.equal(scene.children.length,0);assert.equal(records.size,0);assert.equal(disposed,i+1);
  }
  assert.equal(captured.length,expectedCapture);material.dispose();
}
run(plant.replace(loose,'scene.add(g);'),6); // reproduce the previous retained set
run(plant,0);
console.log('Board ornament: six rebuild/dispose cycles, zero retained chapter captures; old path retains six.');
