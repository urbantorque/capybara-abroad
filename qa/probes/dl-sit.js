async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = await page.evaluate(() => {
    const g=window.__capy; g.biome.switchTo('quay');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.quay, b=g.capy.body, R={trace:[], firedAt:-1};
    function helm(){ const h=a.boat.helm;
      b.position.set(h.x,h.y+0.5,h.z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(b.position.x,b.position.y,b.position.z); }
    helm();
    for(let i=0;i<90;i++){ g.input.action=true; g.input.actionPressed=(i===0); g.tick(1/60,false); }
    g.input.action=false; g.input.actionPressed=false;
    R.atHelm=g.capy.atHelm;
    let f=0;
    function step(z){ g.input.z=z; g.input.x=0; g.tick(1/60,false); f++;
      if(!g.capy.atHelm) helm();
      if(R.firedAt<0 && g.noticed('let-her-sit')) R.firedAt=f;
      if(f%600===0) R.trace.push({f, p:+a.voyageProgress().toFixed(3),
        s:+(a.boat.speed||0).toFixed(2)}); }
    // accelerate out into the harbour
    while(a.voyageProgress()<0.35 && f<40000) step(-1);
    R.drivenTo={f, p:+a.voyageProgress().toFixed(3), s:+(a.boat.speed||0).toFixed(2)};
    // pull the throttle back and let her come to rest
    for(let i=0;i<600;i++) step(1);
    for(let i=0;i<300;i++) step(0);
    R.stopped={f, p:+a.voyageProgress().toFixed(3), s:+(a.boat.speed||0).toFixed(2)};
    for(let i=0;i<2700 && R.firedAt<0;i++) step(0);
    R.end={f, p:+a.voyageProgress().toFixed(3), s:+(a.boat.speed||0).toFixed(2)};
    R.got=g.noticed('let-her-sit'); R.err=g.state.lastError||null; return R;
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-sit.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out);
}
