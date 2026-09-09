async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const JOBS = [['cali','floor'],['sahara','dune'],['drift','lantern'],['pantanal','afloat']];
  const out = {};
  for (const [bio, job] of JOBS) {
    out[bio+'/'+job] = await page.evaluate((arg) => {
      const g = window.__capy, nm = arg.bio;
      g.biome.switchTo(nm);
      for(let i=0;i<60;i++) g.tick(1/60,false);
      const a=g[nm], b=g.capy.body, R={id:null,note:null};
      function gy(x,z){ try{const h=a.terrainHeight(x,z); return h===h?h:0;}catch(e){return 0;} }
      function wy(x,z){ try{ if(a.localWater===true&&a.waterHeightAt) return a.waterHeightAt(x,z);}catch(e){}
        return (typeof a.waterLevel==='number')?a.waterLevel:0; }
      function put(x,z,y){ b.position.set(x,y,z); b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
        g.capy.position.set(x,y,z); }
      function park(x,z,frames,y0){ const y=(y0===undefined?gy(x,z)+0.45:y0); put(x,z,y);
        for(let i=0;i<frames;i++){ g.tick(1/60,false);
          const p=g.capy.position; if(Math.hypot(p.x-x,p.z-z)>1.0) put(x,z,y); } }
      if(arg.job==='floor'){ R.id='floor-after-dark';
        const f=a.floor; const fx=(f&&f.x!==undefined)?f.x:-22, fz=(f&&f.z!==undefined)?f.z:52;
        R.note='night='+a.night()+' floor='+fx.toFixed(0)+','+fz.toFixed(0);
        park(fx,fz,900); R.note+=' inZone='+a.inZone('dancefloor',g.capy.position.x,g.capy.position.z); }
      else if(arg.job==='dune'){ R.id='dune-at-dusk'; const d=a.duneTop;
        R.note='dusk='+a.dusk(); park(d.x,d.z,400);
        R.note+=' y='+g.capy.position.y.toFixed(1); }
      else if(arg.job==='lantern'){ R.id='after-the-lantern'; const l=a.lantern;
        R.note='lit='+a.lit()+' lant='+l.x+','+l.z+','+(l.y||0);
        park(l.x,l.z,2000, (l.y!==undefined?l.y+0.6:undefined));
        R.note+=' y='+g.capy.position.y.toFixed(1); }
      else if(arg.job==='afloat'){ R.id='dusk-afloat'; const ba=a.baia;
        R.note='dusk='+a.dusk();
        const y=wy(ba.x,ba.z)-0.15; put(ba.x,ba.z,y);
        for(let i=0;i<300;i++){ g.tick(1/60,false);
          const p=g.capy.position; if(Math.hypot(p.x-ba.x,p.z-ba.z)>2.5) put(ba.x,ba.z,y); }
        R.note+=' swim='+!!g.capy.swimming; }
      R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
    }, { bio, job });
  }
  await page.evaluate((o)=>fetch('/shot?name=dl-fire6.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), out);
}
