// Actual collision callback, real Cannon normals, isolated from rendering.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as CANNON from '../vendor/cannon-es.js';
import { stripComments } from '../strip-comments.mjs';
const source=stripComments(readFileSync(new URL('../src/capybara.js',import.meta.url),'utf8'));
const start=source.indexOf("body.addEventListener('collide', function (e) {");
assert.ok(start>=0);
const end=source.indexOf('\n  });',start);
assert.ok(end>start);
const callback=source.slice(start,end+7);
const rows=['capyBONK_V','capyBONK_NY','capyBONK_GAP','capyBARGE_V','capySHOVE_MAX'].map(name=>{
  const row=source.match(new RegExp('^const '+name+'\\s*=\\s*[^;]+;','m'));
  assert.ok(row,'authored '+name);return row[0];
});
let checks=0;
const check=(ok,why)=>{assert.ok(ok,why);checks++;};
function fixture(kind,capyIsBi,angle,speed=10){
  const body=new CANNON.Body({mass:12}), other=new CANNON.Body({mass:kind==='dynamic'?30:0});
  const away=new CANNON.Vec3(Math.cos(angle),0,Math.sin(angle));
  other.position.copy(away);other.position.scale(-1,other.position);
  body.velocity.set(-away.x*speed,0,-away.z*speed);
  if(kind==='person')other.userData={npc:{}};
  const contact=new CANNON.ContactEquation(capyIsBi?body:other,capyIsBi?other:body);
  contact.ni.copy(away);if(capyIsBi)contact.ni.negate(contact.ni);
  let handler;
  body.addEventListener=(name,fn)=>{assert.equal(name,'collide');handler=fn;};
  const q=vm.createContext({body,game:{state:{time:10},sfx(){},events:{emit(){}}},
    capy:{},capyShove:{x:0,z:0},capySwimming:false,capyClinging:false,
    capyBonkAt:-100,capyPop:0,capyPopVel:0,capyEarFlick:0,
    capyPosition:{x:0,z:0},capySfxAt:{},capyBargePayload:{},capyPunch(){},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  vm.runInContext(rows.join('\n')+'\n'+callback,q);
  return {q,body,other,contact,away,fire:()=>handler({body:other,contact})};
}
for(const kind of ['dynamic','wall','person'])for(const order of [false,true])for(let a=0;a<8;a++){
  const f=fixture(kind,order,a*Math.PI/4);
  check(f.contact.getImpactVelocityAlongNormal()>0,'Cannon closing velocity convention');
  f.fire();
  check(f.q.capyShove.x*f.away.x+f.q.capyShove.z*f.away.z>0,
    kind+' rebound must point away, body order '+order+' bearing '+a);
  const separating=fixture(kind,order,a*Math.PI/4,-10);separating.fire();
  check(Math.hypot(separating.q.capyShove.x,separating.q.capyShove.z)===0,
    kind+' separating contact cannot create a fresh shove');
  separating.q.capyShove.x=2;separating.q.capyShove.z=-3;separating.fire();
  check(separating.q.capyShove.x===2&&separating.q.capyShove.z===-3,
    kind+' separating contact preserves an existing tail');
}
for(const order of [false,true]){
  const f=fixture('dynamic',order,Math.PI/4,30);
  for(let i=0;i<30;i++)f.fire();
  check(Math.abs(f.q.capyShove.x)<=6&&Math.abs(f.q.capyShove.z)<=6,
    'repeated entries respect existing external-shove component bounds');
  const light=fixture('dynamic',order,0);light.other.mass=.5;light.fire();
  check(light.q.capyShove.x===0&&light.q.capyShove.z===0,'light props do not shove');
}
console.log('collision shove: '+checks+' actual-callback/Cannon checks; no runtime or frame-time claim');
