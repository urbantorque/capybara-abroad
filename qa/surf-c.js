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
    function ow(x,z){ const a=api(); return (a && typeof a.isOverWater==='function') ? a.isOverWater(x,z) : false; }
    function place(x,z,dy){ b.position.set(x,th(x,z)+(dy===undefined?0.5:dy),z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); sx=0;sz=0;srun=false;sjump=false; T(20); }
    function spd(){ return Math.hypot(b.velocity.x,b.velocity.z); }
    function sw(n){ if(!g.biome.isActive(n)) g.biome.switchTo(n); T(30); }
    function r2(v){ return +v.toFixed(2); }
  `;
  const ev = async (body) => { try { return await page.evaluate(`(() => { ${H} ${body} })()`); } catch (e) { return { ERR: String(e).slice(0, 300) }; } };
  const sink = async () => { try { await page.evaluate(o => fetch('/shot?name=surf-c.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out); } catch (e) { out.errs.push('SINK ' + String(e).slice(0, 100)); } };

  out.slope = await ev(`
    sw('pasto'); const a=api(); const r={ hasWaterTriple:[typeof a.isOverWater, typeof a.waterLevel, typeof a.waterHeightAt] };
    let pick=null; for(let x=-200;x<=200;x+=5) for(let z=-200;z<=200;z+=5){ if(ow(x,z)) continue; if(a.navBlocked&&a.navBlocked(x,z,0.34)) continue; const gx=(th(x+2,z)-th(x-2,z))/4; const gz=(th(x,z+2)-th(x,z-2))/4; const gr=Math.hypot(gx,gz); if(gr>0.28 && gr<0.34 && (!pick||Math.abs(gx)>Math.abs(pick.gx))) pick={x,z,gx:r2(gx),gz:r2(gz),gr:r2(gr)}; }
    r.pick=pick; if(pick){ const L=Math.hypot(pick.gx,pick.gz); const ux=pick.gx/L, uz=pick.gz/L;
      place(pick.x,pick.z); sx=ux; sz=uz; let x0=b.position.x,z0=b.position.z; T(180); r.up={ speed:r2(spd()), grade:r2(g.capy.grade||0), avg:r2(Math.hypot(b.position.x-x0,b.position.z-z0)/3) };
      place(pick.x,pick.z); sx=-ux; sz=-uz; x0=b.position.x; z0=b.position.z; T(180); r.down={ speed:r2(spd()), grade:r2(g.capy.grade||0), avg:r2(Math.hypot(b.position.x-x0,b.position.z-z0)/3) };
      place(pick.x,pick.z); sx=ux; sz=uz; srun=true; T(180); r.upRun={ speed:r2(spd()), grade:r2(g.capy.grade||0) }; srun=false; sx=0; sz=0;
      place(pick.x,pick.z); T(600); r.parked={ moved:r2(Math.hypot(b.position.x-pick.x,b.position.z-pick.z)) }; }
    return r;`);
  await sink();
  out.rainWalk = await ev(`
    sw('kowloon'); const W=g.weather; const sp=g.biome.spawnOf('kowloon'); const r={};
    place(sp.x,sp.z); r.dry={ slipW:r2(W.slip()) }; sx=1; T(150); r.dry.speed=r2(spd()); r.dry.capySlip=r2(g.capy.slip||0); sx=0;
    let waited=0; while(W.slip()<0.2 && waited<9000){ T(30); waited+=30; }
    r.waited=waited; r.wet={ slipW:r2(W.slip()), wetness:r2(W.wetness()) };
    place(sp.x,sp.z); sx=1; T(150); r.wet.speed=r2(spd()); r.wet.capySlip=r2(g.capy.slip||0); sx=0; const xs=b.position.x; let stop=0; for(let i=0;i<600;i++){ T(1); stop++; if(spd()<0.05) break; } r.wet.stopTicks=stop; r.wet.stopDist=r2(Math.abs(b.position.x-xs));
    return r;`);
  await sink();
  out.floe = await ev(`
    sw('antarctic'); const a=api(); const r={};
    let f=null; for(let x=-200;x<=200&&!f;x+=2) for(let z=-200;z<=200&&!f;z+=2){ if(a.groundSlip(x,z)===0.48 && !a.isOverWater(x,z)) f=[x,z]; }
    r.floeAt=f; if(!f) return r;
    b.position.set(f[0], a.waterLevel+0.34+0.5, f[1]); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); T(60);
    r.stand={ y:r2(b.position.y), swim:g.capy.swimming, grounded:g.capy.grounded, frame:[r2(g.capy.frameVX||0), r2(g.capy.frameVZ||0)], th:r2(th(b.position.x,b.position.z)) };
    const x0=b.position.x, z0=b.position.z; T(600); r.ride={ disp:[r2(b.position.x-x0), r2(b.position.z-z0)], swim:g.capy.swimming, y:r2(b.position.y), frame:[r2(g.capy.frameVX||0), r2(g.capy.frameVZ||0)] };
    sx=1; T(120); r.walkOnFloe={ speed:r2(spd()), slip:r2(g.capy.slip||0), swim:g.capy.swimming }; sx=0;
    return r;`);
  await sink();
  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  await sink();
  await page.waitForTimeout(500);
}
