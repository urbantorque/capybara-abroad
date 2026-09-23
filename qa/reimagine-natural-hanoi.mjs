// G: chapter-arrival fixture, then actual walking, grabbing and Cub controls.
// Road targets come from shipped polylines; no gameplay-state writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';
const source=readFileSync(new URL('../src/hanoi.js',import.meta.url),'utf8');
const lanes=vm.runInNewContext(source.match(/const hanLANES = ([^]*?\n\]);/)[1]);
const constant=name=>Number(source.match(new RegExp('const '+name+'\\s*=\\s*([\\d.]+)'))?.[1]);
const door=constant('hanCUB_DOOR_R'),dropRadius=constant('hanCUB_DROP_R'),dropSpeed=constant('hanCUB_DROP_V');
assert.ok(door>0&&dropRadius>0&&dropSpeed>0);
const traceEnabled=process.argv.includes('--trace'),tag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6);
if(tag!==undefined)assert.match(tag,/^[\w-]+$/,'safe artifact tag');
const h=await openHarness(),name='reimagine-natural-hanoi'+(tag?'-'+tag:''),ids=['cross-the-road','pho-raid','pho-run'];
const out={metadata:h.metadata,authored:{lanes,door,dropRadius,dropSpeed},steps:[],navigation:[],bowlEvents:[]};
let held=new Set();
async function keys(want){
  for(const k of held)if(!want.has(k))await h.page.keyboard.up(k);
  for(const k of want)if(!held.has(k))await h.page.keyboard.down(k);
  held=want;
}
const release=()=>keys(new Set());
// Temporary QA observer: method calls and tick boundaries, not a motion writer.
async function installJumpTrace(){if(!traceEnabled)return;await h.page.evaluate(()=>{
  const g=window.__capy,slot='__hanoiJumpTrace',prior=Object.getOwnPropertyDescriptor(window,slot);
  const events=[],frames=[],contacts=[],restores=[],errors=[];let dropped=0,last=null,closed=false;
  const xyz=p=>p?[p.x,p.y,p.z]:null;
  const distance=(a,b)=>a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):0;
  const safe=fn=>{try{return fn();}catch(e){if(errors.length<8)errors.push(String(e));return null;}};
  function snapshot(){const c=g.capy,i=g.input;return{t:g.state.time,wall:performance.now(),
    p:xyz(c.position),body:xyz(c.body.position),velocity:xyz(c.body.velocity),
    solverSaves:g.state.solverSaves||0,worldStep:g.world.stepnumber,
    held:c.heldProp?{type:c.heldProp.type,id:c.heldProp.body?.id,removed:!!c.heldProp.removed}:null,
    carried:!!c.carriedBy,carrier:c.carriedBy?.kind||null,atHelm:!!c.atHelm,rideBody:c.rideBody?.id,
    input:{x:i.x,z:i.z,run:i.run,action:i.action,actionPressed:i.actionPressed,jump:i.jump,honk:i.honk},
    keys:(window.__hanoiKeys||[]).slice(-12)};}
  function record(row){if(events.length>=128){events.splice(64,1);dropped++;}
    events.push({...row,contacts:contacts.slice(),physics:safe(()=>typeof g.physics?.getawayAudit==='function'?g.physics.getawayAudit():null)});}
  function wrap(object,key,make){const descriptor=Object.getOwnPropertyDescriptor(object,key),original=object[key];
    if(typeof original!=='function')return;
    const wrapped=make(original);
    Object.defineProperty(object,key,{configurable:true,writable:true,enumerable:descriptor?.enumerable??false,value:wrapped});
    restores.push(()=>{if(object[key]!==wrapped){if(errors.length<8)errors.push('Observer replaced before cleanup: '+key);return;}
      if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];});
  }
  const objects=new Map();
  for(const[label,object]of[['body.position',g.capy.body.position],['capy.position',g.capy.position]]){
    if(objects.has(object))objects.get(object).push(label);else objects.set(object,[label]);}
  for(const[object,labels]of objects)for(const key of['set','copy'])wrap(object,key,original=>function(...args){
    const before=safe(()=>xyz(this));
    try{return Reflect.apply(original,this,args);}finally{safe(()=>{const after=xyz(this),metres=distance(before,after);
      if(metres>20)record({kind:'position method',method:labels.join(' / ')+'.'+key,metres,before,after,
        state:snapshot(),stack:new Error('Position method changed more than 20m').stack});});}
  });
  function shapeInfo(s){return s?{id:s.id,type:s.type,radius:s.radius,halfExtents:xyz(s.halfExtents),
    radiusTop:s.radiusTop,radiusBottom:s.radiusBottom,height:s.height}:null;}
  function onCapyContact(event){safe(()=>{const c=event.contact,b=event.body;
    // Narrowphase may swap the body order without swapping si/sj. Resolve
    // ownership against the body's actual shapes, not the equation order.
    const otherShape=b.shapes.includes(c.si)?c.si:c.sj,index=b.shapes.indexOf(otherShape);
    contacts.push({t:g.state.time,wall:performance.now(),worldStep:g.world.stepnumber,
      capy:xyz(g.capy.body.position),velocity:xyz(g.capy.body.velocity),
      other:{id:b.id,type:b.type,mass:b.mass,p:xyz(b.position),velocity:xyz(b.velocity),quaternion:b.quaternion.toArray(),
        shapeCount:b.shapes.length,shapes:b.shapes.slice(0,32).map((s,i)=>({...shapeInfo(s),offset:xyz(b.shapeOffsets[i])})),
        contactShape:{...shapeInfo(otherShape),index,offset:xyz(b.shapeOffsets[index]),orientation:b.shapeOrientations[index]?.toArray()}},
      bi:c.bi.id,bj:c.bj.id,normal:xyz(c.ni),ri:xyz(c.ri),rj:xyz(c.rj),enabled:c.enabled,
      impact:c.getImpactVelocityAlongNormal()});
    if(contacts.length>24)contacts.shift();
  });}
  let priorStep=xyz(g.capy.body.position);
  function onWorldPostStep(){safe(()=>{const after=xyz(g.capy.body.position),v=g.capy.body.velocity;
    const metres=distance(priorStep,after),speed=Math.hypot(v.x,v.y,v.z);
    if(metres>20||speed>90)record({kind:'postStep',metres,speed,before:priorStep,after,state:snapshot()});
    priorStep=after;
  });}
  g.capy.body.addEventListener('collide',onCapyContact);
  restores.push(()=>g.capy.body.removeEventListener('collide',onCapyContact));
  g.world.addEventListener('postStep',onWorldPostStep);
  restores.push(()=>g.world.removeEventListener('postStep',onWorldPostStep));
  wrap(g,'tick',original=>function(...args){const before=safe(snapshot);
    safe(()=>{if(last&&before&&(distance(last.body,before.body)>20||distance(last.p,before.p)>20))
      record({kind:'between ticks',before:last,after:before});});
    try{return Reflect.apply(original,this,args);}finally{safe(()=>{const after=snapshot();
      if(before&&(distance(before.body,after.body)>20||distance(before.p,after.p)>20))
        record({kind:'during tick',before,after});
      frames.push({before,after});if(frames.length>60)frames.shift();last=after;
    });}
  });
  window[slot]={read:()=>({events,frames,contacts,errors,dropped,thresholdMetres:20,postStepSpeedThreshold:90,
    scope:'Instance set/copy, tick boundaries and postStep. Events retain first 64 and latest 64. Contact ring 24; first 32 other-body shapes plus exact contact shape. Direct component writes have boundary attribution only.'}),
    close(){if(closed)return;closed=true;for(const restore of restores.reverse())safe(restore);
      if(prior)Object.defineProperty(window,slot,prior);else delete window[slot];}};
});}
async function collectJumpTrace(close=false){
  if(!traceEnabled)return;
  try{const trace=await h.page.evaluate(close=>{const trace=window.__hanoiJumpTrace;if(!trace)return null;
    const result=trace.read();if(close)trace.close();return result;},close);
    if(trace)out.jumpTrace=trace;
  }catch(error){out.jumpTraceReadError=String(error);}
}
async function state(){return h.page.evaluate(ids=>{
  const g=window.__capy,p=g.capy.position;
  return{t:g.state.time,wall:performance.now(),p:p.toArray(),yaw:g.input.camYaw,
    hidden:document.hidden,paused:!!g.state.paused,chapter:g.biome.current,
    carried:!!g.capy.carriedBy,held:g.capy.heldProp?.type||null,velocity:g.capy.body.velocity.toArray(),solverSaves:g.state.solverSaves||0,
    bag:!!document.querySelector('.capyui-bag')?.classList.contains('show'),traveller:g.hintTarget('traveller'),
    cub:g.hanoi.cub(),cross:g.hanoi.crossState(),swerved:g.hanoi.swerved(),
    pho:{...g.hanoi.pho()},
    tasks:Object.fromEntries(ids.map(id=>[id,g.taskDone(id)])),gate:g.gateInfo(19)};
},ids);}
function running(s){assert.ok(!s.hidden&&!s.paused&&s.chapter==='hanoi','visible unpaused Hanoi');}
async function sample(label){const s={label,...await state()};out.steps.push(s);
  console.log(JSON.stringify({label,t:s.t,p:s.p,cub:s.cub,tasks:s.tasks}));return s;}
function steering(s,p,r){
  const dx=p.x-s.p[0],dz=p.z-s.p[2],want=new Set();if(Math.hypot(dx,dz)<r)return want;
  const x=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw),z=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);
  if(Math.abs(x)>Math.abs(z)*.42)want.add(x>0?'d':'a');
  if(Math.abs(z)>Math.abs(x)*.42)want.add(z>0?'s':'w');return want;
}
async function walkingDetour(target){return h.page.evaluate(target=>{
  const g=window.__capy,p=g.capy.body.position,V=p.constructor;
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,candidates=[];
  for(const side of[1,-1]){
    const q={x:p.x-dx/d-dz/d*2.5*side,z:p.z-dz/d+dx/d*2.5*side};
    const vx=q.x-p.x,vz=q.z-p.z,len=Math.hypot(vx,vz),hits=[];
    for(const off of[-.5,0,.5]){
      const ox=-vz/len*off,oz=vx/len*off;
      g.world.raycastAll(new V(p.x+ox,p.y+.35,p.z+oz),new V(q.x+ox,p.y+.35,q.z+oz),
        {skipBackfaces:true},hit=>{if(hit.hasHit&&hit.body!==g.capy.body&&hit.body.collisionResponse!==false)
          hits.push({body:hit.body.id,distance:hit.distance});});
    }
    candidates.push({target:q,hits});
  }
  return{candidates,chosen:candidates.find(c=>!c.hits.length)?.target||null};
},target);}
async function walk(p,r=.8,maxMs=30000,detours=2){
  const end=Date.now()+maxMs;let best=Infinity,progress=Date.now(),from=null;
  try{while(Date.now()<end){const s=await state();running(s);out.navigation.push({phase:'walk',target:p,...s});
    const d=Math.hypot(p.x-s.p[0],p.z-s.p[2]);if(d<r)return;
    if(d<best-.25){best=d;progress=Date.now();}
    if(Date.now()-progress>4500){
      assert.ok(detours-->0,'walking route obstructed: '+JSON.stringify(s));
      await release();const option=await walkingDetour(p);out.navigation.push({phase:'collider detour',...option});
      assert.ok(option.chosen,'both walking detours blocked');
      await walk(option.chosen,.6,12000,0);best=Infinity;progress=Date.now();from=null;continue;
    }
    if(!from)from={x:s.p[0],z:s.p[2]};
    const dx=p.x-from.x,dz=p.z-from.z,length=Math.hypot(dx,dz);
    const along=length?Math.max(0,Math.min(length,((s.p[0]-from.x)*dx+(s.p[2]-from.z)*dz)/length)):0;
    const u=length?Math.min(1,(along+1)/length):1;
    await keys(steering(s,{x:from.x+dx*u,z:from.z+dz*u},r*.5));await h.page.waitForTimeout(80);
  }throw Error('walking waypoint timed out');}finally{await release();}
}
function project(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
  return{x:a.x+t*dx,z:a.z+t*dz,t};}
// Split road segments at their true intersections and endpoint projections.
// Dijkstra chooses connected streets, never a chord through a building/lake.
function route(start,end){
  const segs=[];for(const l of lanes)for(let i=0;i<l.pts.length-(l.closed?0:1);i++){
    const a=l.pts[i],b=l.pts[(i+1)%l.pts.length];segs.push({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},cuts:[0,1]});
  }
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
    const a=segs[i],b=segs[j],rx=a.b.x-a.a.x,rz=a.b.z-a.a.z,sx=b.b.x-b.a.x,sz=b.b.z-b.a.z;
    const det=rx*sz-rz*sx;if(Math.abs(det)<1e-8)continue;
    const dx=b.a.x-a.a.x,dz=b.a.z-a.a.z,t=(dx*sz-dz*sx)/det,u=(dx*rz-dz*rx)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1){a.cuts.push(t);b.cuts.push(u);}
  }
  function nearest(p){let best=null;for(const s of segs){const q=project(p,s.a,s.b),d=Math.hypot(q.x-p.x,q.z-p.z);
    if(!best||d<best.d)best={s,q,d};}best.s.cuts.push(best.q.t);return best.q;}
  const from=nearest(start),to=nearest(end),nodes=[],byKey=new Map();
  function node(p){const k=p.x.toFixed(5)+','+p.z.toFixed(5);if(!byKey.has(k)){byKey.set(k,nodes.length);nodes.push({...p,edges:[]});}return byKey.get(k);}
  for(const s of segs){const cuts=[...new Set(s.cuts)].sort((a,b)=>a-b),index=cuts.map(t=>node({x:s.a.x+(s.b.x-s.a.x)*t,z:s.a.z+(s.b.z-s.a.z)*t}));
    for(let i=1;i<index.length;i++){const a=index[i-1],b=index[i],d=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);
      nodes[a].edges.push([b,d]);nodes[b].edges.push([a,d]);}}
  const a=node(from),b=node(to),dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();dist[a]=0;
  for(;;){let best=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(best<0||dist[i]<dist[best]))best=i;
    if(best<0||!Number.isFinite(dist[best]))break;if(best===b)break;seen.add(best);
    for(const[next,cost]of nodes[best].edges)if(dist[best]+cost<dist[next]){dist[next]=dist[best]+cost;prev[next]=best;}}
  assert.ok(Number.isFinite(dist[b]),'connected authored road route');const path=[];
  for(let i=b;i>=0;i=prev[i]){path.push({x:nodes[i].x,z:nodes[i].z});if(i===a)break;}
  return path.reverse();
}
async function brake(){
  const end=Date.now()+3500;
  try{while(Date.now()<end){const s=await state();running(s);if(Math.abs(s.cub.v)<.25)return;
    await keys(new Set(s.cub.v>0?['s']:['w']));await h.page.waitForTimeout(65);}
    throw Error('Cub did not stop under real braking');}finally{await release();}
}
async function rideTo(target,last=false){
  const end=Date.now()+26000;let best=Infinity,progress=Date.now(),lastHorn=0;
  try{while(Date.now()<end){const s=await state();running(s);assert.ok(s.cub.on,'Cub remains mounted');
    out.navigation.push({phase:'delivery',target,...s});
    assert.ok(s.cub.run||s.tasks['pho-run'],'delivery remains within authored hot-food clock');
    const dx=target.x-s.cub.x,dz=target.z-s.cub.z,d=Math.hypot(dx,dz);
    if(d<(last?1.7:1.8))return;
    if(d<best-.35){best=d;progress=Date.now();}assert.ok(Date.now()-progress<8500,'Cub route obstructed: '+JSON.stringify(s));
    const error=Math.atan2(Math.sin(Math.atan2(dx,dz)-s.cub.yaw),Math.cos(Math.atan2(dx,dz)-s.cub.yaw));
    const desired=Math.abs(error)>.65?0:Math.min(7.5,Math.max(1.2,d*1.1));
    const want=new Set();if(Math.abs(error)>.065)want.add(error>0?'a':'d');
    if(s.cub.v>desired+.3)want.add('s');else if(s.cub.v<desired-.2&&Math.abs(error)<.75)want.add('w');
    if(s.cub.hold>=0&&Date.now()-lastHorn>800){want.add('Space');lastHorn=Date.now();}
    await keys(want);await h.page.waitForTimeout(95);
  }throw Error('Cub waypoint timed out');}finally{await release();}
}
try{
  await h.page.evaluate(()=>{window.__hanoiKeys=[];for(const type of['keydown','keyup'])document.addEventListener(type,e=>
    window.__hanoiKeys.push({type,key:e.code,trusted:e.isTrusted,t:window.__capy.state.time}));});
  await h.start();await h.arrive('hanoi');const arrival=await sample('fresh Hanoi');running(arrival);
  await h.page.evaluate(()=>{window.__hanoiBowlEvents=[];for(const name of['capy:grab','capy:drop','prop:impact','prop:destroy','capy:graze'])
    window.__capy.events.on(name,e=>{const prop=e?.prop||e;
      if(prop?.type==='phobowl')window.__hanoiBowlEvents.push({name,t:window.__capy.state.time,
        x:prop.body?.position.x,y:prop.body?.position.y,z:prop.body?.position.z,
        speed:e?.speed||null,held:!!prop.held,pending:prop.pendingImpact||0,
        hidden:!!prop.hidden,capyHeld:window.__capy.capy.heldProp?.type||null});});});
  assert.ok(ids.every(id=>!arrival.tasks[id]));
  const pho=await h.page.evaluate(()=>{const p=window.__capy.hanoi.pho();return{x:p.x,y:p.y,z:p.z};});
  // Reach the lake's northern street through its actual western ring.
  out.approach=route({x:arrival.p[0],z:arrival.p[2]},{x:0,z:-12});
  for(const p of out.approach)await walk(p,1.2);
  // x=-8 skims the tube-house faces; ordinary eight-way correction can
  // collide with a frontage. Keep inside the pavement before crossing.
  // Also clear the crossing reset boundary (road half-width + 1.8m) before
  // turning: stopping inside that boundary preserves an earlier failed try.
  await walk({x:-7.4,z:-7},1);await walk({x:-7.4,z:pho.z},.25);
  assert.equal((await state()).cross[0],-1,'crossing resets on the near pavement');
  // Face the street with real camera keys, then keep one walking direction.
  // Eight-way waypoint corrections themselves count as crossing hesitation.
  const bearing=-Math.PI/2;
  for(let attempt=0;attempt<12;attempt++){const s=await state(),a=Math.atan2(Math.sin(s.yaw-bearing),Math.cos(s.yaw-bearing));
    out.navigation.push({phase:'crossing camera',...s});if(Math.abs(a)<.07)break;
    await keys(new Set([a>0?'x':'z']));await h.page.waitForTimeout(Math.max(12,Math.min(250,Math.abs(a)/2.4*1000)));
    await release();await h.page.waitForTimeout(350);}
  await release();const aligned=await state();assert.ok(Math.abs(Math.atan2(Math.sin(aligned.yaw-bearing),Math.cos(aligned.yaw-bearing)))<.09);
  const crossEnd=Date.now()+8000;
  try{await keys(new Set(['w']));while(Date.now()<crossEnd){const s=await state();running(s);
    out.navigation.push({phase:'steady crossing',...s});if(s.p[0]>9)break;await h.page.waitForTimeout(90);}}
  finally{await release();}
  await walk({x:pho.x,z:pho.z},.65);
  await h.page.waitForFunction(()=>window.__capy.taskDone('cross-the-road'),null,{timeout:3000});
  await sample('crossing earned');
  await installJumpTrace();
  for(let i=0;i<4&&!((await state()).tasks['pho-raid']);i++){
    await h.hold('e',90);await h.page.waitForTimeout(550);
    out.bowlEvents.push({attempt:i+1,...await state()});
  }
  out.bowlEvents.push(...await h.page.evaluate(()=>window.__hanoiBowlEvents||[]));
  assert.ok((await state()).tasks['pho-raid'],'actual nearby bowl grabbed');
  await sample('pho raid earned');await h.screenshot(name+'-bowl');
  assert.equal((await state()).held,'phobowl','real bowl remains held before release');
  await h.hold('e',90);await h.page.waitForTimeout(550);
  const dropped=await sample('bowl release observed');
  assert.equal(dropped.bag,false,'throw does not also open the traveller bag');running(dropped);
  const stall=await h.page.evaluate(()=>window.__capy.hanoi.cubStall());
  await walk({x:stall.x+1.5,z:stall.z},.55);await h.hold('e',90);
  await h.page.waitForFunction(()=>window.__capy.hanoi.cub().on,null,{timeout:3500});
  await sample('Cub mounted');out.routes=[];
  for(let i=0;i<3;i++){
    const s=await state(),drop=await h.page.evaluate(i=>window.__capy.hanoi.dropAt(i),i);
    const path=route({x:s.cub.x,z:s.cub.z},drop);out.routes.push({drop,path});
    for(let j=0;j<path.length;j++)await rideTo(path[j],j===path.length-1);
    await brake();await h.page.waitForFunction(i=>window.__capy.hanoi.cub().next>i,i,{timeout:3000});
    await sample('bowl '+(i+1)+' delivered');await h.screenshot(name+'-drop-'+i);
  }
  const end=await sample('Hanoi memory');assert.ok(ids.every(id=>end.tasks[id])&&end.gate.enough);
  await h.page.waitForFunction(ids=>{const s=JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}');return ids.every(id=>s.tasks?.includes(id));},ids,{timeout:12000});
  out.keys=await h.page.evaluate(()=>window.__hanoiKeys);assert.ok(out.keys.length&&out.keys.every(k=>k.trusted));
  await collectJumpTrace(true);
  if(traceEnabled){assert.ok(out.jumpTrace,'diagnostic captured');assert.deepEqual(out.jumpTrace.errors,[],'observer stayed valid');
    assert.equal(out.jumpTrace.events.length,0,'no large position jump or solver speed spike');}
  await h.page.reload();await h.start();const resumed=await sample('Hanoi memory resumed');
  assert.ok(ids.every(id=>resumed.tasks[id])&&resumed.gate.enough);assert.deepEqual(h.metadata.errors,[]);
  out.scope='Chapter arrival fixture, shipped-road navigation telemetry and actual keyboard walking/grab/Cub steering/braking/horn. No task/body/clock/vehicle/debug-state writes. Not novice or unguided pacing proof.';
  await h.result(name,out);console.log(JSON.stringify({pass:true,samples:out.navigation.length,errors:h.metadata.errors}));
}catch(error){await collectJumpTrace(true);await release();out.failure=String(error.stack||error);try{
    out.bowlEvents.push(...await h.page.evaluate(()=>window.__hanoiBowlEvents||[]));
    await sample('failure');await h.screenshot(name+'-failure');}catch{}
  await h.result(name+'-failure',out);throw error;}finally{await collectJumpTrace(true);await h.close();}
