async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft','KeyF','KeyH','KeyC'];
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', {code:c, bubbles:true}));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', {code:c, bubbles:true}));
    let seed = 4242; const rnd = () => { seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
    g.biome.switchTo('cave');
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const held = new Set();
    let lx=0,ly=0,lz=0, frozenAt=-1, log=[];
    for (let i=0;i<60*60;i++) {
      if (i % 17 === 0) {
        for (const k of held) up(k); held.clear();
        const n = 1 + (rnd()*3|0);
        for (let j=0;j<n;j++) { const k=KEYS[rnd()*KEYS.length|0]; held.add(k); down(k); }
      }
      g.tick(1/60,false);
      const p = g.capy.position;
      const d = Math.hypot(p.x-lx,p.y-ly,p.z-lz);
      if (i>60 && d < 1e-9 && frozenAt<0) {
        frozenAt = i;
        log.push({ i, p:{x:p.x,y:p.y,z:p.z}, held:[...held],
          climbing:g.capy.climbing, swimming:g.capy.swimming, diving:g.capy.diving,
          held2:!!g.capy.heldProp, grounded:g.capy.grounded, atHelm:g.capy.atHelm,
          paused:g.state.paused, sailing:g.state.sailing, dt:g.state.dt, ts:g.time&&g.time.scale });
      }
      lx=p.x;ly=p.y;lz=p.z;
    }
    const p = g.capy.position;
    return { frozenAt, log, finalPos:{x:p.x,y:p.y,z:p.z}, paused:g.state.paused,
      dt:g.state.dt, timeScale: g.time && g.time.scale, bodyType: g.capy.body.type,
      bodyMass: g.capy.body.mass, sleepState: g.capy.body.sleepState };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=j5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
