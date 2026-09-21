// Crossing attribution, not a frame-time benchmark. No game-state writes.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const args=process.argv.slice(2),gpuFences=args.includes('--gpu-fences');
assert.ok(args.filter(a=>a==='--gpu-fences').length<=1,'one GPU diagnostic flag');
const positional=args.filter(a=>a!=='--gpu-fences');
assert.ok(positional.length<=1,'usage: node qa/reimagine-crossing-trace.mjs [tag] [--gpu-fences]');
const tag=positional[0]||'trace';
assert.match(tag,/^[\w-]+$/,'safe optional artifact tag');
const name='reimagine-crossing-'+tag;
const h=await openHarness({pinRung:false});
const report={metadata:h.metadata,gpuFences,rows:[],scope:'Attribution only: public crosses and real clocks. Scene/material snapshots add main-thread overhead; neither rAF gaps nor longtasks in this instrument are performance acceptance evidence. Optional flushed GPU fences alter command submission; signal timing is inference only, not proof that the GPU caused a hitch.',
  inspectedThree:'vendor/three.module.js: WebGLProgram id/cacheKey; renderer.info.programs; renderer.properties.has/get; materialProperties.currentProgram. get is called only after has, avoiding new property records.'};
try {
  await h.start();
  assert.equal(await h.page.evaluate(()=>window.__capy.state.started),true,'actual startup');
  for(const chapter of ['pasto','quay','sydney']) {
    const row=await h.page.evaluate(async ({chapter,gpuFences})=>{
      const g=window.__capy,renderer=g.renderer,fade=document.querySelector('.capyui-fade');
      const start=performance.now(),frames=[],snapshots=[],longtasks=[];
      let observer=null,observerSupported=false,observerError=null;
      let last=start,lastRaf=null,seenOn=false,offAt=null,offFrame=null,previousCount=renderer.info.programs?.length??null;
      let snapshotPrevious=false,raf=0,finished=false,timer=0;
      const gl=gpuFences?renderer.getContext():null;
      const gpu={enabled:gpuFences,supported:false,constants:null,destination:null,created:null,polls:[],
        outcome:gpuFences?'not-created':'disabled',signal:null,deleted:false,error:null,
        note:'One nonblocking fence after warm hold clears and two submitted draws since first observed destination rAF. That conservative baseline may exclude an earlier destination draw. No gl.finish or blocking wait; polling bounds when completion was observed, not its exact GPU timestamp.'};
      let sync=null,fenceAttempted=false;
      if(gl) {
        const names=['SYNC_GPU_COMMANDS_COMPLETE','ALREADY_SIGNALED','CONDITION_SATISFIED','TIMEOUT_EXPIRED','WAIT_FAILED'];
        gpu.constants=Object.fromEntries(names.map(k=>[k,typeof gl[k]==='number'?gl[k]:null]));
        gpu.supported=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext&&
          ['fenceSync','clientWaitSync','deleteSync','flush'].every(k=>typeof gl[k]==='function')&&
          names.every(k=>typeof gl[k]==='number');
        if(!gpu.supported)gpu.outcome='unsupported';
      }
      function deleteFence() {
        if(!sync)return;
        try{gl.deleteSync(sync);gpu.deleted=true;}catch(error){gpu.error=String(error);}
        sync=null;
      }
      function fenceFrame(frame) {
        if(!gpuFences||!gpu.supported)return;
        if(!gpu.destination&&frame.chapter===chapter)
          gpu.destination={frame:frame.index,at:frame.at,gameFrames:frame.gameFrames};
        if(!fenceAttempted&&gpu.destination&&frame.chapter===chapter&&!frame.renderHold&&
            frame.gameFrames-gpu.destination.gameFrames>=2) {
          fenceAttempted=true;
          gpu.created={frame:frame.index,at:performance.now(),startRelative:performance.now()-start,
            gameFrames:frame.gameFrames,drawsSinceObservedChange:frame.gameFrames-gpu.destination.gameFrames,
            fadeOn:frame.fadeOn,rung:frame.rung,renderHold:frame.renderHold};
          try {
            sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
            if(sync){gl.flush();gpu.outcome='pending';}else gpu.outcome='creation-returned-null';
          }catch(error){gpu.error=String(error);gpu.outcome='creation-error';deleteFence();}
        }
        if(sync) {
          try {
            const status=gl.clientWaitSync(sync,0,0),at=performance.now();
            const label=Object.keys(gpu.constants).find(k=>gpu.constants[k]===status)||'unknown';
            const poll={frame:frame.index,at,startRelative:at-start,status,label,fadeOn:frame.fadeOn,
              gameFrames:frame.gameFrames,rung:frame.rung,sinceCreationMs:at-gpu.created.at};
            gpu.polls.push(poll);frame.gpuFenceStatus=label;
            if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED) {
              gpu.outcome='signaled';gpu.signal=poll;deleteFence();
            }else if(status===gl.WAIT_FAILED){gpu.outcome='wait-failed';deleteFence();}
            else if(status!==gl.TIMEOUT_EXPIRED){gpu.outcome='unexpected-status';deleteFence();}
          }catch(error){gpu.error=String(error);gpu.outcome='poll-error';deleteFence();}
        }
      }
      const programs=()=>Array.isArray(renderer.info.programs)?renderer.info.programs:[];
      const programInfo=p=>p?{id:typeof p.id==='number'?p.id:null,
        cacheKey:typeof p.cacheKey==='string'?p.cacheKey:null,
        name:typeof p.name==='string'?p.name:null,usedTimes:typeof p.usedTimes==='number'?p.usedTimes:null}:null;
      let known=new Set(programs().map(p=>p.id));
      const initialPrograms=programs().map(programInfo);
      function snapshot(frameIndex,newIds) {
        const began=performance.now(),props=renderer.properties,materials=new Map();
        g.scene.traverse(object=>{
          const list=Array.isArray(object.material)?object.material:[object.material];
          for(const material of list) {
            if(!material)continue;
            let rec=materials.get(material.uuid);
            if(!rec) {
              let current=null,available=false;
              if(props&&typeof props.has==='function'&&typeof props.get==='function'&&props.has(material)) {
                const stored=props.get(material);
                available=!!stored&&Object.hasOwn(stored,'currentProgram');
                if(available)current=programInfo(stored.currentProgram);
              }
              rec={uuid:material.uuid,type:material.type||null,name:material.name||null,
                visible:material.visible,currentProgramAvailable:available,currentProgram:current,objects:[]};
              materials.set(material.uuid,rec);
            }
            let visibleInTree=true;
            for(let p=object;p;p=p.parent)if(!p.visible){visibleInTree=false;break;}
            rec.objects.push({uuid:object.uuid,name:object.name||null,type:object.type||null,
              visible:object.visible,visibleInTree,parentUuid:object.parent?.uuid||null,parentName:object.parent?.name||null});
          }
        });
        const list=[...materials.values()],currentPrograms=programs().map(programInfo);
        const matched=list.filter(m=>m.currentProgram&&newIds.includes(m.currentProgram.id)).map(m=>m.uuid);
        const ended=performance.now();
        return {frameIndex,start:began,end:ended,durationMs:ended-began,newProgramIds:newIds,
          programs:currentPrograms,materials:list,matchingMaterialUuids:matched,
          unmatchedNewProgramIds:newIds.filter(id=>!list.some(m=>m.currentProgram?.id===id)),
          diagnosticOnly:true,note:'Expensive scene traversal. currentProgram is only the last selected material program, not a complete variant history. Off-scene/postprocessing/shadow programs may be unmatched.'};
      }
      if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        try {
          observer=new PerformanceObserver(entries=>{
            for(const entry of entries.getEntries())longtasks.push({name:entry.name,start:entry.startTime,
              duration:entry.duration,deliveredAtFrame:frames.length-1});
          });
          observer.observe({type:'longtask',buffered:false});observerSupported=true;
        }catch(error){observerError=String(error);}
      }
      let result;
      try { result=await new Promise((resolve,reject)=>{
        function finish(reason) {
          if(finished)return;finished=true;cancelAnimationFrame(raf);clearTimeout(timer);
          resolve({reason,elapsed:performance.now()-start});
        }
        function sample(timestamp) {
          if(finished)return;
          try {
            const now=performance.now(),on=!!fade?.classList.contains('on'),count=renderer.info.programs?.length??null;
            if(on)seenOn=true;
            if(seenOn&&!on&&offAt===null){offAt=now-start;offFrame=frames.length;}
            const ids=programs().map(p=>p.id),newIds=ids.filter(id=>!known.has(id));
            const frame={index:frames.length,at:now,startRelative:now-start,rafTimestamp:timestamp,gap:now-last,
              rafTimestampGap:lastRaf===null?null:timestamp-lastRaf,gameFrames:g.state.frames??null,gpuFenceStatus:null,
              chapter:g.biome.current,started:!!g.state.started,hidden:document.hidden,paused:!!g.state.paused,
              renderHold:!!g.state.renderHold,fadeOn:on,afterFade:offAt!==null,
              programs:count,geometries:renderer.info.memory.geometries,drawCalls:renderer.info.render.calls,
              triangles:renderer.info.render.triangles,warmN:g.state.warmN??null,warmMs:g.state.warmMs??null,
              rung:g.state.perfRung??null,snapshotIndex:null,previousFrameHadSnapshot:snapshotPrevious};
            frames.push(frame);last=now;lastRaf=timestamp;snapshotPrevious=false;
            fenceFrame(frame);
            if(offAt!==null&&previousCount!==null&&count>previousCount) {
              frame.snapshotIndex=snapshots.length;snapshots.push(snapshot(frame.index,newIds));snapshotPrevious=true;
            }
            known=new Set(ids);previousCount=count;
            if(now-start>=9000)finish('nine-second real-clock window');else raf=requestAnimationFrame(sample);
          }catch(error){finished=true;clearTimeout(timer);reject(error);}
        }
        timer=setTimeout(()=>finish('watchdog: rAF did not complete window'),12000);
        raf=requestAnimationFrame(sample);
        g.hud.cross(chapter);
      }); } finally {
        if(sync&&gpu.outcome==='pending')gpu.outcome='window-ended-before-signal';
        deleteFence();
      }
      // Let the observer deliver the last task before disconnecting it.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(observer){for(const e of observer.takeRecords())longtasks.push({name:e.name,start:e.startTime,duration:e.duration,deliveredAtFrame:frames.length-1});observer.disconnect();}
      for(const task of longtasks)task.overlapsDiagnosticSnapshot=snapshots.some(s=>task.start<s.end&&task.start+task.duration>s.start);
      gpu.pendingObservedAfterFadeOff=gpu.polls.some(p=>p.label==='TIMEOUT_EXPIRED'&&!p.fadeOn&&offAt!==null&&p.startRelative>=offAt);
      gpu.signalObservationAfterFadeMs=gpu.signal&&offAt!==null?gpu.signal.startRelative-offAt:null;
      return {requested:chapter,actual:g.biome.current,start,initialPrograms,result,seenOn,offAt,offFrame,
        frames,snapshots,longtasks,gpuFence:gpu,observerSupported,observerError,lastError:g.state.lastError||null,
        finalPrograms:programs().map(programInfo),note:'rAF is sampled alongside the game, not inside a render or GPU timer. Snapshot frame and following gap are explicitly marked.'};
    },{chapter,gpuFences});
    report.rows.push(row);
    await h.result(name,report);
    assert.equal(row.actual,chapter,'actual chapter arrival');
    assert.equal(row.result.reason,'nine-second real-clock window','uninterrupted real-clock trace');
    assert.ok(row.seenOn&&row.offAt!==null,'actual crossing fade observed');
    assert.ok(row.frames.every(f=>f.started&&!f.hidden),'started foreground trace');
    assert.equal(row.lastError,null,'no game runtime error');
    if(chapter==='quay')await h.screenshot(name+'-quay-settled');
    console.log(JSON.stringify({chapter,frames:row.frames.length,offAt:row.offAt,
      snapshots:row.snapshots.map(s=>({frame:s.frameIndex,newProgramIds:s.newProgramIds,matchingMaterialUuids:s.matchingMaterialUuids})),
      longtasks:row.longtasks.length,rung:row.frames.at(-1)?.rung,
      gpuFence:{outcome:row.gpuFence.outcome,created:row.gpuFence.created,signal:row.gpuFence.signal}}));
  }
  assert.deepEqual(h.metadata.errors,[],'zero runtime errors');
  await h.result(name,report);
} catch(error) {
  report.failure=String(error.stack||error);
  try{await h.result(name+'-failure',report);}catch{}
  throw error;
} finally {await h.close();}
