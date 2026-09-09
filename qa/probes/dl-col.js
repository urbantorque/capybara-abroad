async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('antarctic');
    for (let i=0;i<40;i++) g.tick(1/60,false);
    const a = g.antarctic, b = g.capy.body, R = { s: [] };
    const c2 = a.colony;
    function put(x,z){ let y=0; try{y=a.terrainHeight(x,z);}catch(e){}
      b.position.set(x,y+0.45,z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(b.position.x,b.position.y,b.position.z); }
    put(c2.x, c2.z);
    for (let i=0;i<2400;i++){
      g.tick(1/60,false);
      const p=g.capy.position;
      if (Math.hypot(p.x-c2.x,p.z-c2.z)>0.9) put(c2.x,c2.z);
      if (i%300===0) { const v=g.capy.velocity; const pp=g.capy.position;
        R.s.push({f:i, gr:g.capy.grounded, sp:+Math.hypot(v.x,v.z).toFixed(2),
          inz:a.inZone('colony',p.x,p.z), sw:!!g.capy.swimming, y:+p.y.toFixed(1),
          car:!!g.capy.carriedBy, fvx:+(g.capy.frameVX||0).toFixed(2), fvz:+(g.capy.frameVZ||0).toFixed(2), px:+pp.x.toFixed(2), pz:+pp.z.toFixed(2), slp:+(g.capy.slip||0).toFixed(2)}); }
    }
    R.got = g.noticed('ignored'); R.err = g.state.lastError||null;
    return R;
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-col.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out);
}
