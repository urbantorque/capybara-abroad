async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const JOBS = [['cave','drip'], ['goreme','dawn'], ['goreme','herd'], ['iceland','spring']];
  const out = {};
  for (const [bio, job] of JOBS) {
    out[bio + '/' + job] = await page.evaluate((arg) => {
      const g = window.__capy, nm = arg.bio;
      g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1/60, false);
      const a = g[nm], b = g.capy.body;
      function gy(x,z){ try{ const h=a.terrainHeight(x,z); return h===h?h:0; }catch(e){ return 0; } }
      function put(x,z,y){ b.position.set(x,y,z); b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
        g.capy.position.set(x,y,z); }
      function park(x,z,frames){ put(x,z,gy(x,z)+0.45);
        for(let i=0;i<frames;i++){ g.tick(1/60,false);
          const p=g.capy.position; if(Math.hypot(p.x-x,p.z-z)>0.9) put(x,z,gy(x,z)+0.45); } }
      const R={id:null,note:null};
      if(arg.job==='drip'){ R.id='wet-in-a-mountain';
        // hunt for a drip column and stand under it
        let best=null, bd=1e9;
        for(let k=0;k<600&&!g.noticed(R.id);k++){
          // sample: walk the passage and park wherever soaking() answers
          const x=-30+((k*13)%61), z=-20-((k*7)%70);
          put(x,gy(x,z)+0.45,z);
          for(let i=0;i<10;i++) g.tick(1/60,false);
          const s=a.soaking?a.soaking(x,z):0;
          if(s>0){ best={x,z}; break; }
        }
        R.note='column='+JSON.stringify(best);
        if(best){ park(best.x,best.z,900); R.note+=' wet='+g.capy.wet.toFixed(2); } }
      else if(arg.job==='dawn'){ R.id='dawn-from-below'; const t=a.town;
        put(t.x, gy(t.x,t.z)+0.45, t.z);
        let w=0; while(a.sunUp()<0.03&&w<36000){ g.tick(1/60,false); w++;
          const p=g.capy.position; if(Math.hypot(p.x-t.x,p.z-t.z)>0.9) put(t.x,gy(t.x,t.z)+0.45,t.z); }
        R.note='sunUp='+a.sunUp().toFixed(3)+' waited='+w;
        park(t.x,t.z,400); R.note+=' after='+a.sunUp().toFixed(3); }
      else if(arg.job==='herd'){ R.id='kept-up';
        let w=0; while(!a.mareRunning()&&w<36000){ g.tick(1/60,false); w++; }
        R.note='ranAfter='+w;
        for(let i=0;i<2400&&!g.noticed('kept-up');i++){
          const m=a.mare();
          const p=g.capy.position;
          if(Math.hypot(p.x-(m.x+2.6),p.z-m.z)>3.5) put(m.x+2.6, gy(m.x+2.6,m.z)+0.45, m.z);
          else { const dz=m.z-p.z, dx=(m.x+2.6)-p.x, d=Math.max(0.01,Math.hypot(dx,dz));
                 b.velocity.x=dx/d*3.4; b.velocity.z=dz/d*3.4; }
          g.tick(1/60,false);
        }
        const v=g.capy.velocity;
        R.note+=' running='+a.mareRunning()+' sp='+Math.hypot(v.x,v.z).toFixed(2)+
                ' gr='+g.capy.grounded; }
      else if(arg.job==='spring'){ R.id='spring-and-sky'; const s=a.spring;
        put(s.x, gy(s.x,s.z)+0.45, s.z);
        let w=0;
        while(w<54000&&!g.noticed(R.id)){
          g.tick(1/60,false); w++;
          const p=g.capy.position;
          if(Math.hypot(p.x-s.x,p.z-s.z)>0.9) put(s.x,gy(s.x,s.z)+0.45,s.z);
        }
        R.note='waited='+w+' soak='+a.soak().toFixed(2)+
               ' rain='+(g.weather?g.weather.drizzle().toFixed(2):'?'); }
      R.got=g.noticed(R.id); R.err=g.state.lastError||null;
      return R;
    }, { bio, job });
  }
  await page.evaluate((o)=>fetch('/shot?name=dl-fire4.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), out);
}
