// Real keys, authored waypoints, no task/save/body writes. Public arrival is
// a fixture; this is route feasibility, not unaided discovery or novice pacing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openHarness} from './reimagine-harness.mjs';

export async function lateMemory(h, chapter, tag='v5') {
  assert(['cave','iceland'].includes(chapter));
  assert.match(tag,/^[\w-]+$/);
  const source=readFileSync(new URL('../src/'+chapter+'.js',import.meta.url),'utf8');
  const point=name=>{
    const m=source.match(new RegExp('const '+name+'\\s*=\\s*\\{\\s*x:\\s*(-?[\\d.]+),\\s*z:\\s*(-?[\\d.]+)'));
    assert(m,'authored point '+name);return{x:Number(m[1]),z:Number(m[2])};
  };
  const ids=chapter==='cave'?['first-echo','the-doline']:['organ','hot-spring'];
  const out={chapter,ids,steps:[],navigation:[],scope:'Real keys with authored waypoints; public arrival fixture.'};
  const held=new Set();
  async function keys(want){
    for(const k of [...held])if(!want.has(k)){await h.page.keyboard.up(k);held.delete(k);}
    for(const k of want)if(!held.has(k)){await h.page.keyboard.down(k);held.add(k);}
  }
  async function state(){return h.page.evaluate(ids=>{
    const g=window.__capy,p=g.capy.body.position,yaw=g.input.camYaw;
    return {p:{x:p.x,y:p.y,z:p.z},forward:{x:-Math.sin(yaw),z:-Math.cos(yaw)},focused:document.hasFocus()&&!document.hidden,
      paused:!!g.state.paused,chapter:g.biome.current,error:g.state.lastError||null,
      tasks:Object.fromEntries(ids.map(id=>[id,g.taskDone(id)]))};
  },ids);}
  async function walk(target,radius=2,limit=60000){
    let best=Infinity,moved=Date.now(),detours=0;const until=Date.now()+limit;
    try{while(Date.now()<until){
      const s=await state();assert(s.focused&&!s.paused&&s.chapter===chapter&&!s.error,'live focused route');
      assert(Object.values(s.p).every(Number.isFinite),'finite body');
      const dx=target.x-s.p.x,dz=target.z-s.p.z,d=Math.hypot(dx,dz);
      out.navigation.push({target,d,...s});if(d<radius)return;
      if(d<best-.5){best=d;moved=Date.now();}
      let f=(dx*s.forward.x+dz*s.forward.z)/d,r=(-dx*s.forward.z+dz*s.forward.x)/d;
      if(Date.now()-moved>4000){
        assert(detours<4,'bounded approach blocked');const side=1;detours++;
        [f,r]=[-r*side,f*side];moved=Date.now();best=d;
        const bypass=new Set();if(f>.3)bypass.add('KeyW');if(f<-.3)bypass.add('KeyS');
        if(r>.3)bypass.add('KeyD');if(r<-.3)bypass.add('KeyA');
        await keys(bypass);await h.page.waitForTimeout(1500);continue;
      }
      const want=new Set();if(f>.28)want.add('KeyW');if(f<-.28)want.add('KeyS');
      if(r>.28)want.add('KeyD');if(r<-.28)want.add('KeyA');
      await keys(want);await h.page.waitForTimeout(100);
    }throw Error('walk timed out: '+JSON.stringify(target));}finally{await keys(new Set());}
  }
  try{
    await h.start();await h.arrive(chapter);await h.page.bringToFront();
    out.steps.push(await state());
    if(chapter==='cave'){
      // The entrance floor has solid breakdown. The authored river corridor
      // excludes those rocks and provides a real swimming route to the light.
      await walk({x:-20,z:56},8);await walk({x:-20,z:20});
      await h.page.keyboard.press('KeyQ');await h.page.waitForTimeout(1200);
      assert((await state()).tasks['first-echo'],'actual wheek earns dark-cave support');
      await walk({x:-20,z:-48});await walk(point('cavDOLINE'),8);
    }else{
      await walk(point('iceORGAN'),2);await h.page.keyboard.press('KeyE');await h.page.waitForTimeout(800);
      assert((await state()).tasks.organ,'actual action earns organ support');
      await walk({x:0,z:72});await walk({x:0,z:35});await walk(point('iceSPRING'),2);
      const seconds=Number(source.match(/const iceSOAK_T\s*=\s*([\d.]+)/)?.[1]);assert(seconds>0);
      await h.page.waitForTimeout((seconds+4)*1000);
    }
    await h.page.waitForFunction(ids=>ids.every(id=>window.__capy.taskDone(id)),ids,{timeout:12000});
    out.steps.push(await state());
    await h.page.waitForFunction(ids=>{const s=JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}');
      return ids.every(id=>s.tasks?.includes(id));},ids);
    out.saved=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')));
    out.memory=await h.page.evaluate(n=>window.__capy.gateInfo(n),chapter==='cave'?16:7);
    assert(out.memory.enough,'earned tasks satisfy the live memory gate');
    assert.equal(h.metadata.errors.length,0);out.pass=true;
  }catch(e){out.pass=false;out.failure=String(e.stack||e);throw Object.assign(e,{routeEvidence:out});}
  finally{await keys(new Set());await h.result('homecoming-late-memory-'+chapter+'-'+tag,out);await h.screenshot('homecoming-late-memory-'+chapter+'-'+tag);}
  return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const h=await openHarness();try{const out=await lateMemory(h,process.argv[2]||'cave');console.log(JSON.stringify({chapter:out.chapter,pass:out.pass}));}
  catch(e){console.error(e.message);process.exitCode=1;}finally{await h.close();}
}
