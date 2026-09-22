// Real scene ownership and release body; a souvenir must remain global.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
const main=readFileSync('src/main.js','utf8'),src=readFileSync('src/props.js','utf8');
const start=main.indexOf('function mainMakeBiomes(game)'),end=main.indexOf('\n  return biome;\n}',start)+18;
const make=vm.runInNewContext('('+main.slice(start,end)+')',{console});
function fn(name){return src.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))?.[0]||'';}
let checks=0;
for(const global of [true,false]){
  const scene=new THREE.Scene(),world=new CANNON.World();
  const game={scene,world,events:{emit(){}},state:{time:1},capy:{velocity:new THREE.Vector3()}};
  game.biome=make(game);game.biome._patchWorld();game.biome._setTag('sydney');
  const mouth=new THREE.Group(),mesh=new THREE.Mesh();scene.add(mouth);mouth.add(mesh);
  const body=new CANNON.Body({mass:.05});body.addShape(new CANNON.Box(new CANNON.Vec3(.1,.1,.1)));
  if(global)CANNON.World.prototype.addBody.call(world,body);else world.addBody(body);
  const prop={mesh,body,biome:global?'':'sydney',type:'fixture',held:true,spin:1};
  game.capy.heldProp=prop;
  const c={THREE,CANNON,physGame:game,physV1:new THREE.Vector3(),physQ1:new THREE.Quaternion(),physCV1:new CANNON.Vec3(),
    physDropPayload:{},physTYPES:{fixture:{}},rand:a=>a,physDryOut(){},physStampTouch(){},physSetSolo(){},
    physSyncBodyTransform:b=>{b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);}};
  vm.createContext(c);vm.runInContext(fn('physSceneAddLoose')+'\n'+fn('physSceneReturnProp')+'\n'+fn('physRelease'),c);
  c.physRelease(null);assert.equal(mesh.parent,scene);assert.equal(prop.held,false);checks+=2;
  assert.equal(!!game.biome.objectsOf('sydney')?.includes(mesh),!global,'release preserves ownership');checks++;
  game.biome.attach('sydney',false);
  assert.equal(mesh.parent,global?scene:null,'global mesh survives departure');checks++;
  assert.equal(world.bodies.includes(body),global,'mesh and body leave or remain together');checks++;
  game.biome.attach('sydney',true);assert.equal(mesh.parent,scene);checks++;
  if(global){
    game.biome.claim('sydney',mesh);c.physSceneReturnProp(prop);
    assert(!game.biome.objectsOf('sydney').includes(mesh),'return repairs stale capture');checks++;
  }
}
for(const name of ['physRelease','physDropOwned','physSpill','physHide']){
  assert(fn(name).includes('physSceneReturnProp(prop)'),'ownership-aware return in '+name);checks++;
}
console.log(checks+' loose-prop ownership checks passed');
