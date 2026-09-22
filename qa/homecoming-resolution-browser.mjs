// Headful render coverage: actual quality modes, desktop/phone canvas and
// window resize. This is not a frame-rate or real-mobile-device certificate.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag=process.argv[2]||'v1';assert.match(tag,/^[\w-]+$/);
for(const mode of ['pretty','fast']){
  const h=await openHarness({pinRung:false,storage:{'capy3.prefs.v1':{v:1,pf:mode==='pretty'?1:2}}});
  const report={mode,metadata:h.metadata,steps:[]};
  try{
    await h.start();await h.arrive('hanoi');
    for(const [width,height] of [[1280,760],[390,844],[1280,760]]){
      await h.page.setViewportSize({width,height});await h.page.waitForTimeout(1500);
      const s=await h.page.evaluate(()=>{
        const g=window.__capy,c=g.renderer.domElement,t=g.post.warmTarget();
        return {canvas:[c.width,c.height],css:[innerWidth,innerHeight],dpr:g.renderer.getPixelRatio(),
          scale:g.state.sceneScale||1,target:[t.width,t.height],rung:g.state.perfRung,
          viewport:g.renderer.getContext().getParameter(g.renderer.getContext().VIEWPORT),
          error:g.state.lastError,post:g.post.enabled};
      });
      assert(s.post&&!s.error);assert.equal(s.rung,mode==='pretty'?0:3);
      assert.equal(s.scale,mode==='pretty'?1:.6);
      assert.deepEqual(s.canvas,[Math.floor(width*s.dpr),Math.floor(height*s.dpr)]);
      assert.deepEqual(s.target,s.canvas.map(n=>Math.floor(n*s.scale)));
      assert.deepEqual(Object.values(s.viewport),[0,0,...s.canvas],'final composite covers full native canvas');
      report.steps.push(s);await h.screenshot('homecoming-resolution-'+mode+'-'+width+'-'+tag);
    }
    assert.deepEqual(h.metadata.errors,[]);report.pass=true;
  }catch(e){report.failure=String(e.stack||e);throw e;}
  finally{await h.result('homecoming-resolution-'+mode+'-'+tag,report);await h.close();}
}
console.log('Stable canvas: Pretty/Fast at desktop/phone/desktop sizes pass.');
