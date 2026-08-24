async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = {};
  out['cave/drip'] = await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('cave');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.cave, b=g.capy.body, R={id:'wet-in-a-mountain'};
    function put(x,z){ const y=a.terrainHeight(x,z)+0.45;
      b.position.set(x,y,z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(x,y,z); }
    const d0=a.nearestDrip();
    R.note='drip='+d0.x.toFixed(1)+','+d0.z.toFixed(1);
    put(d0.x, d0.z);
    for(let i=0;i<1500&&!g.noticed(R.id);i++){
      g.tick(1/60,false);
      const p=g.capy.position;
      if(Math.hypot(p.x-d0.x,p.z-d0.z)>0.5) put(d0.x,d0.z);
    }
    R.note+=' soak='+a.soaking().toFixed(2)+' wet='+g.capy.wet.toFixed(2);
    R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
  });
  out['goreme/herd'] = await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('goreme');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.goreme, b=g.capy.body, R={id:'kept-up'};
    function put(x,z){ const y=a.terrainHeight(x,z)+0.45;
      b.position.set(x,y,z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(x,y,z); }
    let best=0;
    for(let round=0; round<6 && !g.noticed(R.id); round++){
      let w=0; while(!a.mareRunning()&&w<9000){ g.tick(1/60,false); w++; }
      const m0=a.mare(); put(m0.x+2.6, m0.z);
      for(let i=0;i<1400&&a.mareRunning()&&!g.noticed(R.id);i++){
        const m=a.mare(), p=g.capy.position;
        const dx=(m.x+2.6)-p.x, dz=m.z-p.z, d=Math.hypot(dx,dz);
        if(d>10) put(m.x+2.6,m.z);
        else { b.velocity.x=dx*1.6; b.velocity.z=dz*1.6+2.6; b.wakeUp(); }
        g.tick(1/60,false);
        const v=g.capy.velocity, sp=Math.hypot(v.x,v.z);
        if(sp>best) best=sp;
      }
    }
    R.note='bestSp='+best.toFixed(2);
    R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
  });
  out['iceland/spring'] = await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('iceland');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.iceland, b=g.capy.body, R={id:'spring-and-sky'};
    const s0=a.spring;
    function put(){ const y=a.terrainHeight(s0.x,s0.z)+0.45;
      b.position.set(s0.x,y,s0.z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(s0.x,y,s0.z); }
    put();
    let maxRain=0, w=0;
    while(w<90000 && !g.noticed(R.id)){
      g.tick(1/60,false); w++;
      const p=g.capy.position;
      if(Math.hypot(p.x-s0.x,p.z-s0.z)>1.0) put();
      if(w%30===0){ const r=g.weather.drizzle(); if(r>maxRain) maxRain=r; }
    }
    R.note='waited='+w+' maxRain='+maxRain.toFixed(2)+' soak='+a.soak().toFixed(2);
    R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-fire5.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), out);
}
