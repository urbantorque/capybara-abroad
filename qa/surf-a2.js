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
      for(let i=0;i<300;i++){ T(1); stop++; if(spd()<0.05) break; }
      return { speeds:s, peak:r2(pk), disp:[r2(dx),r2(dz)], dist:r2(Math.hypot(dx,dz)), stopTicks:stop, stopDist:r2(Math.hypot(b.position.x-xs,b.position.z-zs)), slip:r2(g.capy.slip||0), grade:r2(g.capy.grade||0), swim:g.capy.swimming, y:r2(b.position.y), th:r2(th(b.position.x,b.position.z)) };
    }
  `;
  const ev = async (body) => { try { return await page.evaluate(`(() => { ${H} ${body} })()`); } catch (e) { return { ERR: String(e).slice(0, 300) }; } };

  // Antarctica: blue ice ON LAND, flat-ish
  out.antarctic = await ev(`
    sw('antarctic'); const a=api(); const sp=g.biome.spawnOf('antarctic');
    let best=null, snow=null;
    for(let x=-220;x<=220;x+=3) for(let z=-220;z<=220;z+=3){
      const h=th(x,z); if(h < -0.3) continue; if(a.isOverWater(x,z)) continue; if(a.navBlocked&&a.navBlocked(x,z,0.34)) continue;
      const fl=Math.max(Math.abs(th(x+3,z)-h),Math.abs(th(x,z+3)-h),Math.abs(th(x-3,z)-h),Math.abs(th(x,z-3)-h));
      const s=a.groundSlip(x,z);
      if(s>0.85 && (!best||fl<best.fl)) best={x,z,s:r2(s),fl:r2(fl),h:r2(h)};
      if(s>0.1 && s<0.3 && fl<0.3 && (!snow||fl<snow.fl)) snow={x,z,s:r2(s),fl:r2(fl),h:r2(h)};
    }
    const r={best,snow};
    if(best){ r.iceWalkX=walkTest(best.x,best.z,[1,0],false,300); r.iceRunX=walkTest(best.x,best.z,[1,0],true,300); r.iceWalkZ=walkTest(best.x,best.z,[0,1],false,300); r.iceIdle=walkTest(best.x,best.z,[0,0],false,300); }
    if(snow){ r.snowWalk=walkTest(snow.x,snow.z,[1,0],false,300); r.snowRun=walkTest(snow.x,snow.z,[1,0],true,300); }
    return r;`);

  // geyser with a real offset from the vent
  out.geyser = await ev(`
    sw('iceland'); const a=api(); const s=a.strokkur; const r={};
    for(const off of [[2.5,0],[0,-2.5]]){
      place(s.x+off[0],s.z+off[1]); let fired=-1, apex=b.position.y, pkh=0, air=0, land=null, v1=null, v5=null, v20=null;
      for(let i=0;i<1500;i++){ T(1); if(fired<0 && b.velocity.y>12){ fired=i; v1=[r2(b.velocity.x),r2(b.velocity.z), g.capy.grounded]; }
        if(fired>=0){ const k=i-fired; if(k===5) v5=[r2(b.velocity.x),r2(b.velocity.z),g.capy.grounded]; if(k===20) v20=[r2(b.velocity.x),r2(b.velocity.z),g.capy.grounded];
          apex=Math.max(apex,b.position.y); pkh=Math.max(pkh,spd()); if(!g.capy.grounded && !g.capy.swimming) air+=D; else if(air>0.3){ land=[r2(b.position.x-s.x-off[0]), r2(b.position.z-s.z-off[1])]; break; } } }
      r['off'+off.join('_')]={ fired, apex:r2(apex), peakH:r2(pkh), airtime:r2(air), landDrift:land, v1, v5, v20 };
    }
    return r;`);

  // storm: per-tick velocity log at full storm, hop FIRST
  out.storm = await ev(`
    sw('sahara'); const a=api();
    let px=200, pz=-60; place(px,pz); let waited=0; while(a.storm()<0.95 && waited<4000){ T(10); waited+=10; }
    const r={ waited, storm:r2(a.storm()) }; if(a.storm()<0.5) return r;
    // 1. standing hop at full storm
    place(px,pz); T(30); let x0=b.position.x, z0=b.position.z; sjump=true; sedge=true; let apex=b.position.y, pkh=0, air=0, left=false; const vlog=[];
    for(let i=0;i<600;i++){ T(1); if(i<70 && i%5===0) vlog.push([r2(b.velocity.x), r2(b.velocity.y), g.capy.grounded?1:0]); if(!g.capy.grounded){ left=true; air+=D; apex=Math.max(apex,b.position.y); pkh=Math.max(pkh,spd()); } else if(left && i>5) break; }
    sjump=false; r.hop={ airtime:r2(air), apexRise:r2(apex-th(x0,z0)-0.34), peakH:r2(pkh), landDisp:[r2(b.position.x-x0), r2(b.position.z-z0)], storm:r2(a.storm()), vlog };
    // 2. idle log
    place(px,pz); T(30); x0=b.position.x; const ilog=[]; for(let i=0;i<120;i++){ T(1); if(i%10===0) ilog.push([r2(b.velocity.x), r2(b.velocity.z), g.capy.grounded?1:0, r2(b.position.x-x0)]); }
    r.idle={ log:ilog, disp:r2(b.position.x-x0), storm:r2(a.storm()) };
    // 3. walk +x (into the wind) log
    place(px,pz); T(30); x0=b.position.x; sx=1; const wlog=[]; for(let i=0;i<120;i++){ T(1); if(i%10===0) wlog.push([r2(b.velocity.x), r2(b.velocity.z), g.capy.grounded?1:0, r2(b.position.x-x0), r2(g.capy.slip||0)]); }
    sx=0; r.walkInto={ log:wlog, disp:r2(b.position.x-x0), storm:r2(a.storm()), th0:r2(th(px,pz)), thM:r2(th(px-8,pz)), thP:r2(th(px+8,pz)) };
    // 4. walk -x (with the wind)
    place(px,pz); T(30); x0=b.position.x; sx=-1; const w2=[]; for(let i=0;i<120;i++){ T(1); if(i%10===0) w2.push([r2(b.velocity.x), r2(b.velocity.z), g.capy.grounded?1:0, r2(b.position.x-x0)]); }
    sx=0; r.walkWith={ log:w2, disp:r2(b.position.x-x0), storm:r2(a.storm()) };
    // 5. run-hop downwind at full storm
    place(px,pz); T(30); sx=-1; srun=true; T(90); const xj=b.position.x, zj=b.position.z; sjump=true; sedge=true; pkh=0; air=0; left=false;
    for(let i=0;i<600;i++){ T(1); if(!g.capy.grounded){ left=true; air+=D; pkh=Math.max(pkh,spd()); } else if(left && i>5) break; }
    sjump=false; sx=0; srun=false; r.runHopDownwind={ airtime:r2(air), peakH:r2(pkh), hopDist:r2(Math.hypot(b.position.x-xj,b.position.z-zj)), storm:r2(a.storm()) };
    // 6. run-hop upwind
    place(px,pz); T(30); sx=1; srun=true; T(90); const xk=b.position.x, zk=b.position.z; const vIn=r2(b.velocity.x); sjump=true; sedge=true; pkh=0; air=0; left=false;
    for(let i=0;i<600;i++){ T(1); if(!g.capy.grounded){ left=true; air+=D; pkh=Math.max(pkh,spd()); } else if(left && i>5) break; }
    sjump=false; sx=0; srun=false; r.runHopUpwind={ vIn, airtime:r2(air), peakH:r2(pkh), hopDisp:[r2(b.position.x-xk), r2(b.position.z-zk)], storm:r2(a.storm()) };
    return r;`);

  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  await page.evaluate(o => fetch('/shot?name=surf-a2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
  await page.waitForTimeout(500);
}
