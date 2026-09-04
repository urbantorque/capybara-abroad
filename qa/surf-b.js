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
    let sx=0, sz=0, srun=false, sjump=false, sedge=false, sact=false;
    function T(k){ for(let i=0;i<k;i++){ inp.x=sx; inp.z=sz; inp.run=srun; inp.camYaw=0; inp.jump=sjump; inp.jumpPressed=sedge; inp.action=sact; sedge=false; g.tick(D,false);} }
    function api(){ const n=g.biome.current; return n==='sydney'?g.env:g[n]; }
    function th(x,z){ const a=api(); return (a&&a.terrainHeight)?a.terrainHeight(x,z):0; }
    function wy(x,z){ const a=api(); return (a.localWater===true && a.waterHeightAt)? a.waterHeightAt(x,z) : (typeof a.waterLevel==='number'? a.waterLevel : -0.5); }
    function place(x,z,dy){ b.position.set(x,th(x,z)+(dy===undefined?0.5:dy),z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); sx=0;sz=0;srun=false;sjump=false; T(20); }
    function placeW(x,z){ b.position.set(x,wy(x,z)-0.2,z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); sx=0;sz=0;srun=false;sjump=false; T(20); }
    function spd(){ return Math.hypot(b.velocity.x,b.velocity.z); }
    function sw(n){ if(!g.biome.isActive(n)) g.biome.switchTo(n); T(30); }
    function r2(v){ return +v.toFixed(2); }
    function flowMax(a, R, step){ let m=0, at=null; for(let x=-R;x<=R;x+=step) for(let z=-R;z<=R;z+=step){ if(!a.isOverWater(x,z)) continue; const f=a.flow(x,z); if(!f) continue; const s=Math.hypot(f.x||0,f.z||0); if(s>m){ m=s; at=[x,z,r2(f.x),r2(f.z)]; } } return { max:r2(m), at }; }
    function swimTest(x,z,dir,ticks){ placeW(x,z); sx=dir[0]; sz=dir[1]; const x0=b.position.x, z0=b.position.z; let jumps=0, lx=x0, lz=z0, minZ=z0, maxZ=z0; const fr=[];
      for(let i=0;i<ticks;i++){ T(1); const d=Math.hypot(b.position.x-lx,b.position.z-lz); if(d>3) jumps++; lx=b.position.x; lz=b.position.z; minZ=Math.min(minZ,lz); maxZ=Math.max(maxZ,lz); if(i%200===0) fr.push([r2(g.capy.frameVX||0), r2(g.capy.frameVZ||0), r2(b.velocity.x), r2(b.velocity.z)]); }
      sx=0; sz=0; const a=api(); const f=a.flow(b.position.x,b.position.z)||{x:0,z:0};
      return { disp:[r2(b.position.x-x0), r2(b.position.z-z0)], swim:g.capy.swimming, y:r2(b.position.y), wy:r2(wy(b.position.x,b.position.z)), flowEnd:[r2(f.x),r2(f.z)], jumps, minZ:r2(minZ), maxZ:r2(maxZ), fr, end:[r2(b.position.x), r2(b.position.z)] }; }
  `;
  const ev = async (body) => { try { return await page.evaluate(`(() => { ${H} ${body} })()`); } catch (e) { return { ERR: String(e).slice(0, 300) }; } };

  out.flowMax = await ev(`const r={}; for(const n of ['cave','kyoto','manly','pantanal','rio']){ sw(n); const a=api(); r[n]=flowMax(a,260,4); } return r;`);
  out.manly = await ev(`
    sw('manly'); const a=api(); const r={ wl:a.waterLevel, wyRip:r2(wy(-34,-5)), thRip:r2(th(-34,-5)), over:a.isOverWater(-34,-5), flowHere:a.flow(-34,-5) };
    r.againstRip = swimTest(-34,-5,[0,1],600);
    r.acrossRip = swimTest(-34,-5,[1,0],600);
    r.driftNoInput = swimTest(-34,-5,[0,0],1800);
    r.driftMore = (function(){ const x0=b.position.x, z0=b.position.z; let jumps=0, lx=x0, lz=z0; for(let i=0;i<1800;i++){ T(1); const d=Math.hypot(b.position.x-lx,b.position.z-lz); if(d>3) jumps++; lx=b.position.x; lz=b.position.z; } return { end:[r2(b.position.x), r2(b.position.z), r2(b.position.y)], swim:g.capy.swimming, jumps, wyEnd:r2(wy(b.position.x,b.position.z)) }; })();
    return r;`);
  out.kyoto = await ev(`
    sw('kyoto'); const a=api(); const m=flowMax(a,260,3); const r={m};
    if(m.at){ const fx=m.at[2], fz=m.at[3], s=Math.hypot(fx,fz)||1; const ux=fx/s, uz=fz/s;
      r.against = swimTest(m.at[0],m.at[1],[-ux,-uz],600); r.with = swimTest(m.at[0],m.at[1],[ux,uz],300); r.none = swimTest(m.at[0],m.at[1],[0,0],600); }
    return r;`);
  out.cave = await ev(`
    sw('cave'); const a=api(); const m=flowMax(a,200,3); const r={m};
    if(m.at){ const fx=m.at[2], fz=m.at[3], s=Math.hypot(fx,fz)||1; const ux=fx/s, uz=fz/s;
      r.against = swimTest(m.at[0],m.at[1],[-ux,-uz],600); r.none = swimTest(m.at[0],m.at[1],[0,0],900); }
    return r;`);
  out.slope = await ev(`
    sw('pasto'); const a=api(); const r={};
    let pick=null; for(let x=-200;x<=200;x+=4) for(let z=-200;z<=200;z+=4){ if(a.isOverWater(x,z)) continue; if(a.navBlocked&&a.navBlocked(x,z,0.34)) continue; const h=th(x,z); const gx=(th(x+2,z)-th(x-2,z))/4; const gz=(th(x,z+2)-th(x,z-2))/4; const gr=Math.hypot(gx,gz); if(gr>0.28 && gr<0.34 && (!pick||Math.abs(gx)>Math.abs(pick.gx))) pick={x,z,gx:r2(gx),gz:r2(gz),gr:r2(gr)}; }
    r.pick=pick; if(pick){ const ux=pick.gx/Math.hypot(pick.gx,pick.gz), uz=pick.gz/Math.hypot(pick.gx,pick.gz);
      place(pick.x,pick.z); sx=ux; sz=uz; const x0=b.position.x,z0=b.position.z; T(180); r.up={ speed:r2(spd()), grade:r2(g.capy.grade||0), dist:r2(Math.hypot(b.position.x-x0,b.position.z-z0)/3) };
      place(pick.x,pick.z); sx=-ux; sz=-uz; const x1=b.position.x,z1=b.position.z; T(180); r.down={ speed:r2(spd()), grade:r2(g.capy.grade||0), dist:r2(Math.hypot(b.position.x-x1,b.position.z-z1)/3) };
      place(pick.x,pick.z); sx=ux; sz=uz; srun=true; T(180); r.upRun={ speed:r2(spd()), grade:r2(g.capy.grade||0) }; srun=false; sx=0; sz=0; }
    return r;`);
  out.rain = await ev(`
    sw('kowloon'); const W=g.weather; const r={ rows:[] }; const sp=g.biome.spawnOf('kowloon'); place(sp.x,sp.z);
    for(let i=0;i<7200;i++){ T(1); if(i%900===0) r.rows.push([r2(g.state.time||0), r2(W.wetness()), r2(W.slip()), r2(g.capy.slip||0), r2(Math.hypot(W.gust().x,W.gust().z))]); }
    return r;`);
  out.venice = await ev(`
    sw('venice'); const a=api(); const r={ rows:[] }; let mn=1e9,mx=-1e9;
    placeW(0,0); if(!a.isOverWater(0,0)){ let f=null; for(let x=-120;x<=120&&!f;x+=4) for(let z=-120;z<=120&&!f;z+=4){ if(a.isOverWater(x,z) && a.isOverWater(x+3,z) && a.isOverWater(x-3,z)) f=[x,z]; } if(f) placeW(f[0],f[1]); r.at=f; }
    for(let i=0;i<7200;i++){ T(1); const w=a.waterLevel; mn=Math.min(mn,w); mx=Math.max(mx,w); if(i%1200===0) r.rows.push([r2(w), r2(b.position.y), r2(b.position.y-w), g.capy.swimming]); }
    r.tide=[r2(mn),r2(mx)]; return r;`);

  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  await page.evaluate(o => fetch('/shot?name=surf-b.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
  await page.waitForTimeout(500);
}
