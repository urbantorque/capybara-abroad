// Observe post-solver bodies before mainSaneWorld clamps them. No physics writes.
// Synthetic input uses the fuzz seed; this is not human or earned-play evidence.
import assert from 'node:assert/strict';
import {openHarness,CHAPTERS} from './reimagine-harness.mjs';
const chapter=process.argv[2]||'sahara', tag=process.argv[3]||'first';
assert(CHAPTERS.includes(chapter)&&/^[\w-]+$/.test(tag));
const h=await openHarness({pinRung:false});
const out={chapter,tag,metadata:h.metadata,fixture:'post-step observation, synthetic fuzz keys'};
try{
  await h.start();
  if(process.argv.includes('--prefix')){
    for(const name of CHAPTERS.slice(1,CHAPTERS.indexOf(chapter))){
      await h.arrive(name);
    }
  }
  if(process.argv.includes('--direct')){
    await h.page.evaluate(chapter=>{
      const g=window.__capy;g.biome.switchTo(chapter);
      const sp=g.biome.spawnOf(chapter),b=g.capy.body;
      b.position.set(sp.x,sp.y,sp.z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);
    },chapter);
    await h.page.waitForTimeout(300);
  }else await h.arrive(chapter);
  out.trace=await h.page.evaluate(async chapter=>{
    const g=window.__capy,raw=g.world.step,records=new Map();
    const startSaves=g.state.solverSaves||0, start=performance.now();
    let badFocus=0,steps=0;
    g.world.step=function(...args){
      const result=raw.apply(this,args);steps++;
      if(document.hidden||!document.hasFocus())badFocus++;
      for(const b of this.bodies){
        if(b.mass>0&&b.sleepState===2)continue;
        const p=b.position,v=b.velocity, speed=Math.hypot(v.x,v.y,v.z);
        if([p.x,p.y,p.z,v.x,v.y,v.z].every(Number.isFinite)&&speed<=90)continue;
        let r=records.get(b.id);
        if(!r){
          const prop=g.props.find(p=>p.body===b);
          r={id:b.id,mass:b.mass,type:b.type,shapes:b.shapes.map(s=>s.type),
            capy:b===g.capy.body,prop:prop?{type:prop.type,biome:prop.biome,keep:prop.keep,held:prop.held,
              home:[prop.homeX,prop.homeY,prop.homeZ],removed:prop.removed}:null,
            group:b.collisionFilterGroup,mask:b.collisionFilterMask,linearDamping:b.linearDamping,
            count:0,peak:0,first:[],last:null};records.set(b.id,r);
        }
        r.count++;r.peak=Math.max(r.peak,speed);
        const contacts=g.world.contacts.filter(c=>c.bi===b||c.bj===b).slice(0,12).map(c=>{
          const other=c.bi===b?c.bj:c.bi;
          return{id:other.id,mass:other.mass,type:other.type,p:other.position.toArray(),shapes:other.shapes.map(s=>s.type)};
        });
        const sample={t:+((performance.now()-start)/1000).toFixed(3),p:p.toArray(),v:v.toArray(),force:b.force.toArray(),sleep:b.sleepState,contacts};
        if(r.first.length<8)r.first.push(sample);r.last=sample;
      }
      return result;
    };
    const keys=['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft'],held=new Set();
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
    let seed=1234567^chapter.length*7919;
    const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return((seed>>>0)%100000)/100000;};
    try{
      while(performance.now()-start<45000){
        if(rnd()<.09){const k=keys[(rnd()*keys.length)|0];if(held.has(k)){key('keyup',k);held.delete(k);}else{key('keydown',k);held.add(k);}}
        await new Promise(r=>setTimeout(r,16));
        if(g.state.paused&&!document.hidden){key('keydown','Escape');key('keyup','Escape');}
      }
    }finally{for(const k of held)key('keyup',k);g.world.step=raw;}
    return{steps,badFocus,solverSaves:(g.state.solverSaves||0)-startSaves,bodies:[...records.values()]};
  },chapter);
  assert.equal(out.trace.badFocus,0);assert.equal(h.metadata.errors.length,0);
  out.pass=true;
}catch(e){out.pass=false;out.failure=String(e.stack||e);process.exitCode=1;}
finally{await h.result('homecoming-solver-'+chapter+'-'+tag,out);await h.close();console.log(JSON.stringify({pass:out.pass,trace:out.trace,failure:out.failure}));}
