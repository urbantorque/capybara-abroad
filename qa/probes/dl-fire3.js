async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const JOBS = [
    ['quay','bridge'], ['kowloon','water'], ['kowloon','market'],
    ['palawan','wreck'], ['palawan','bangka'], ['manly','pool'],
    ['cave','drip'], ['venice','cafe'], ['venice','pigeons'],
    ['goreme','dawn'], ['goreme','herd'], ['iceland','spring']
  ];
  const out = {};
  for (const [bio, job] of JOBS) {
    out[bio + '/' + job] = await page.evaluate((arg) => {
      const g = window.__capy, nm = arg.bio;
      g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1/60, false);
      const a = nm === 'sydney' ? g.env : g[nm];
      const b = g.capy.body;
      function gy(x,z){ try{ const h=a.terrainHeight(x,z); return h===h?h:0; }catch(e){ return 0; } }
      function wy(x,z){ try{ if(a.localWater===true&&a.waterHeightAt) return a.waterHeightAt(x,z); }catch(e){}
        return (typeof a.waterLevel==='number')?a.waterLevel:0; }
      function put(x,z,y){ b.position.set(x,y,z); b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
        g.capy.position.set(x,y,z); }
      function swim(x,z,dy,frames,dive){
        const y = wy(x,z) + (dy===undefined?-0.2:dy);
        put(x,z,y);
        for(let i=0;i<frames;i++){
          if(dive){ g.input.action=true; g.input.actionPressed=(i===0); }
          g.tick(1/60,false);
          const p=g.capy.position;
          if(Math.hypot(p.x-x,p.z-z)>2.5) put(x,z,y);
        }
        if(dive){ g.input.action=false; }
      }
      function park(x,z,frames,dy){
        const y=gy(x,z)+(dy===undefined?0.45:dy); put(x,z,y);
        for(let i=0;i<frames;i++){ g.tick(1/60,false);
          const p=g.capy.position; if(Math.hypot(p.x-x,p.z-z)>0.9) put(x,z,gy(x,z)+(dy===undefined?0.45:dy)); }
      }
      const R={id:null,note:null};
      if(arg.job==='bridge'){ R.id='swam-the-bridge'; const br=a.bridge;
        swim(br.x, br.z, -0.15, 240);
        R.note='swim='+!!g.capy.swimming+' br='+br.x+','+br.z; }
      else if(arg.job==='water'){ R.id='lit-from-the-water';
        let w=0; while(a.show()<0.4&&w<36000){ g.tick(1/60,false); w++; }
        R.note='waited='+w+' show='+a.show().toFixed(2);
        if(a.show()>=0.4) swim(0,-140,-0.15,400);
        R.note+=' swim='+!!g.capy.swimming; }
      else if(arg.job==='market'){ R.id='missed-the-show';
        let w=0; while(a.show()<0.55&&w<36000){ g.tick(1/60,false); w++; }
        R.note='show='+a.show().toFixed(2); park(30,18,500); }
      else if(arg.job==='wreck'){ R.id='inside-the-wreck';
        swim(21,-21,-1.2,600,true); R.note='diving='+!!g.capy.diving+' d='+(g.capy.depth||0).toFixed(1); }
      else if(arg.job==='bangka'){ R.id='under-the-bangka'; const bk=a.bangka();
        swim(bk.x,bk.z,-2.0,600,true); R.note='diving='+!!g.capy.diving; }
      else if(arg.job==='pool'){ R.id='over-the-wall'; const p=a.pool;
        let w=0; while(a.setNear()<0.75&&w<36000){ g.tick(1/60,false); w++; }
        R.note='setNear='+a.setNear().toFixed(2)+' waited='+w;
        swim(p.x,p.z,-0.15,200); R.note+=' swim='+!!g.capy.swimming; }
      else if(arg.job==='drip'){ R.id='wet-in-a-mountain';
        swim(0,-40,-0.2,180); R.note='wet='+g.capy.wet.toFixed(2);
        park(0,-52,900); R.note+=' after='+g.capy.wet.toFixed(2); }
      else if(arg.job==='cafe'){ R.id='flooded-cafe';
        let w=0; while(!a.flooded()&&w<36000){ g.tick(1/60,false); w++; }
        R.note='flooded='+a.flooded()+' waited='+w; const cf=a.cafe; park(cf.x,cf.z,400); }
      else if(arg.job==='pigeons'){ R.id='pigeons-back';
        const pz=a.piazza; park(pz.x,pz.z,120);
        g.events.emit('capy:wheek',{position:g.capy.position});
        for(let i=0;i<200;i++) g.tick(1/60,false);
        R.note='up='+a.pigeonsUp();
        let w=0; while(a.pigeonsUp()&&w<7200){ g.tick(1/60,false); w++; }
        R.note+=' down_after='+w; park(pz.x,pz.z,1400); }
      else if(arg.job==='dawn'){ R.id='dawn-from-below'; const t=a.town;
        put(t.x, gy(t.x,t.z)+0.45, t.z);
        let w=0; while(!a.sunUp()&&w<36000){ g.tick(1/60,false); w++;
          const p=g.capy.position; if(Math.hypot(p.x-t.x,p.z-t.z)>0.9) put(t.x,gy(t.x,t.z)+0.45,t.z); }
        R.note='sunUp='+a.sunUp()+' waited='+w;
        for(let i=0;i<120;i++) g.tick(1/60,false); }
      else if(arg.job==='herd'){ R.id='kept-up';
        for(let i=0;i<1800&&!g.noticed('kept-up');i++){
          const m=a.mare(); put(m.x+2.5, gy(m.x+2.5,m.z)+0.45, m.z);
          b.velocity.set(3.2,0,0); g.tick(1/60,false); }
        R.note='running='+a.mareRunning()+' onMare='+a.onMare(); }
      else if(arg.job==='spring'){ R.id='spring-and-sky'; const s=a.spring;
        park(s.x,s.z,1800); R.note='soak='+a.soak().toFixed(2)+
          ' rain='+(g.weather?g.weather.drizzle().toFixed(2):'n/a'); }
      R.got=g.noticed(R.id); R.err=g.state.lastError||null;
      return R;
    }, { bio, job });
  }
  await page.evaluate((o)=>fetch('/shot?name=dl-fire3.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), out);
}
