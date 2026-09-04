async page => {
  const out = { errs: [] };
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(3000);
  const H = `
    const g = window.__capy, b = g.capy.body, inp = g.input, D = 1/60;
    let sx=0, sz=0, srun=false, sjump=false, sedge=false;
    function T(k){ for(let i=0;i<k;i++){ inp.x=sx; inp.z=sz; inp.run=srun; inp.camYaw=0; inp.jump=sjump; inp.jumpPressed=sedge; sedge=false; g.tick(D,false);} }
    function api(){ const n=g.biome.current; return n==='sydney'?g.env:g[n]; }
    function th(x,z){ const a=api(); return (a&&a.terrainHeight)?a.terrainHeight(x,z):0; }
    function place(x,z,dy){ b.position.set(x,th(x,z)+(dy===undefined?0.5:dy),z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); sx=0;sz=0;srun=false;sjump=false; T(20); }
    function spd(){ return Math.hypot(b.velocity.x,b.velocity.z); }
    function sw(n){ if(!g.biome.isActive(n)) g.biome.switchTo(n); T(30); }
    function r2(v){ return +v.toFixed(2); }
    function walkTest(x,z,dir,run,ticks){
      place(x,z); sx=dir[0]; sz=dir[1]; srun=!!run;
      const x0=b.position.x, z0=b.position.z; const s=[]; let pk=0;
      for(let i=0;i<ticks;i++){ T(1); const v=spd(); if(v>pk)pk=v; if(i===59||i===119||i===ticks-1) s.push(r2(v)); }
      const dx=b.position.x-x0, dz=b.position.z-z0;
      sx=0; sz=0; srun=false; let stop=0; const xs=b.position.x, zs=b.position.z;
      for(let i=0;i<900;i++){ T(1); stop++; if(spd()<0.05) break; }
      return { speeds:s, peak:r2(pk), disp:[r2(dx),r2(dz)], dist:r2(Math.hypot(dx,dz)), stopTicks:stop, stopDist:r2(Math.hypot(b.position.x-xs,b.position.z-zs)), slip:r2(g.capy.slip||0), grade:r2(g.capy.grade||0), swim:g.capy.swimming, y:r2(b.position.y), th:r2(th(b.position.x,b.position.z)) };
    }
  `;
  const ev = async (body) => { try { return await page.evaluate(`(() => { ${H} ${body} })()`); } catch (e) { return { ERR: String(e).slice(0, 300) }; } };

  // calibration: which stick direction is which world axis
  out.calib = await ev(`
    sw('sydney'); const sp=g.biome.spawnOf('sydney');
    const r={};
    place(sp.x,sp.z); sx=1; T(90); r.sx1=[r2(b.position.x-sp.x), r2(b.position.z-sp.z)];
    place(sp.x,sp.z); sz=1; T(90); r.sz1=[r2(b.position.x-sp.x), r2(b.position.z-sp.z)];
    place(sp.x,sp.z); r.paving = walkTest(sp.x, sp.z, [1,0], false, 240);
    r.pavingRun = walkTest(sp.x, sp.z, [1,0], true, 240);
    return r;`);

  // Antarctica: blue ice vs rock, same held key
  out.antarctic = await ev(`
    sw('antarctic'); const a=api(); const sp=g.biome.spawnOf('antarctic');
    let best=null, zero=null;
    for(let x=-200;x<=200;x+=3) for(let z=-200;z<=200;z+=3){
      if(a.isOverWater(x,z)) continue; if(a.navBlocked&&a.navBlocked(x,z,0.34)) continue;
      const h=th(x,z); const fl=Math.max(Math.abs(th(x+3,z)-h),Math.abs(th(x,z+3)-h),Math.abs(th(x-3,z)-h),Math.abs(th(x,z-3)-h));
      if(fl>0.25) continue;
      const s=a.groundSlip(x,z);
      if(!best||s>best.s) best={x,z,s,fl};
      if(s===0 && (!zero||Math.hypot(x-sp.x,z-sp.z)<Math.hypot(zero.x-sp.x,zero.z-sp.z))) zero={x,z,s,fl};
    }
    const r={best,zero};
    if(best) { r.iceWalk=walkTest(best.x,best.z,[1,0],false,240); r.iceRun=walkTest(best.x,best.z,[1,0],true,240); }
    if(zero) { r.rockWalk=walkTest(zero.x,zero.z,[1,0],false,240); r.rockRun=walkTest(zero.x,zero.z,[1,0],true,240); }
    return r;`);

  // Iceland: glacier up / down / idle, vs paving near spawn
  out.iceland = await ev(`
    sw('iceland'); const a=api(); const sp=g.biome.spawnOf('iceland');
    const r={ spawn:sp, slipMid:r2(a.groundSlip(-16,-140)), thSnout:r2(th(-16,-80)), thMid:r2(th(-16,-140)), thTop:r2(th(-16,-190)) };
    r.gradeMid = r2((th(-16,-141)-th(-16,-139))/2);
    r.up = walkTest(-16,-140,[0,-1],false,300);
    r.upRun = walkTest(-16,-140,[0,-1],true,300);
    r.down = walkTest(-16,-140,[0,1],false,300);
    r.idle = walkTest(-16,-140,[0,0],false,600);
    r.pave = walkTest(sp.x,sp.z,[0,-1],false,300);
    r.paveSlip = r2(a.groundSlip(sp.x,sp.z));
    return r;`);

  // Iceland geyser
  out.geyser = await ev(`
    sw('iceland'); const a=api(); const s=a.strokkur;
    place(s.x+0.5,s.z+0.3); let fired=-1, apex=b.position.y, pkh=0, air=0, land=null;
    for(let i=0;i<1500;i++){ T(1); if(fired<0 && b.velocity.y>12){ fired=i; }
      if(fired>=0){ apex=Math.max(apex,b.position.y); pkh=Math.max(pkh,spd()); if(!g.capy.grounded && !g.capy.swimming) air+=D; else if(air>0.3){ land=[r2(b.position.x-s.x), r2(b.position.z-s.z), r2(b.position.y)]; break; } } }
    return { fired, apex:r2(apex), peakH:r2(pkh), airtime:r2(air), land, thHere:r2(th(s.x,s.z)), swim:g.capy.swimming };`);

  // Sahara storm: wait for it in the erg, then idle drift, walk into it, hop in it
  out.storm = await ev(`
    sw('sahara'); const a=api();
    let px=200, pz=0; for(let z=-60; z<=60; z+=4){ if(a.groundSlip(px,z)===0 && !(a.navBlocked&&a.navBlocked(px,z,0.34))){ pz=z; break; } }
    place(px,pz); let waited=0; while(a.storm()<0.95 && waited<4000){ T(10); waited+=10; }
    const r={ waited, storm:r2(a.storm()), at:[px,pz] };
    if(a.storm()<0.5) return r;
    let x0=b.position.x, z0=b.position.z; T(300); r.idle300=[r2(b.position.x-x0), r2(b.position.z-z0), r2(spd())];
    r.walkInto = walkTest(px,pz,[1,0],false,240); r.walkWith = walkTest(px,pz,[-1,0],false,240);
    r.storm2=r2(a.storm());
    place(px,pz); T(60); x0=b.position.x; z0=b.position.z; sjump=true; sedge=true; let apex=b.position.y, pkh=0, air=0, left=false, ticks=0;
    for(let i=0;i<600;i++){ T(1); ticks++; if(!g.capy.grounded){ left=true; air+=D; apex=Math.max(apex,b.position.y); pkh=Math.max(pkh,spd()); } else if(left && i>5) break; }
    sjump=false; r.hop={ airtime:r2(air), apexRise:r2(apex-th(x0,z0)-0.34), peakH:r2(pkh), landDisp:[r2(b.position.x-x0), r2(b.position.z-z0)], storm:r2(a.storm()) };
    place(px,pz); T(60); x0=b.position.x; z0=b.position.z; sx=-1; srun=true; T(120); sjump=true; sedge=true; apex=b.position.y; pkh=0; air=0; left=false; const xj=b.position.x, zj=b.position.z;
    for(let i=0;i<600;i++){ T(1); if(!g.capy.grounded){ left=true; air+=D; pkh=Math.max(pkh,spd()); } else if(left && i>5) break; }
    sjump=false; sx=0; srun=false; r.runHopDownwind={ airtime:r2(air), peakH:r2(pkh), hopDist:r2(Math.hypot(b.position.x-xj,b.position.z-zj)), storm:r2(a.storm()) };
    return r;`);

  // Drift vs Sydney: tap and held hop
  out.hold = await ev(`
    const r={};
    for(const n of ['sydney','drift']){ sw(n); const sp=g.biome.spawnOf(n); r[n]={ g:r2(g.world.gravity.y) };
      for(const held of [false,true]){ place(sp.x,sp.z); T(30); const y0=b.position.y; sjump=true; sedge=true; let apex=y0, air=0, left=false;
        for(let i=0;i<900;i++){ if(!held && i>2) sjump=false; T(1); if(!g.capy.grounded){ left=true; air+=D; apex=Math.max(apex,b.position.y); } else if(left&&i>5) break; }
        sjump=false; r[n][held?'held':'tap']={ apex:r2(apex-y0), airtime:r2(air) }; } }
    sw('sydney'); r.gAfter=r2(g.world.gravity.y);
    return r;`);

  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  await page.evaluate(o => fetch('/shot?name=surf-a.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
  await page.waitForTimeout(500);
}
