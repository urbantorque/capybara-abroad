async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = {};
  out['pasto/carroza'] = await page.evaluate(() => {
    const g=window.__capy; g.biome.switchTo('pasto');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.pasto, b=g.capy.body, R={id:'the-whole-ride'};
    function ride(){ const c=a.carroza();
      b.position.set(c.x, c.y+1.75, c.z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(b.position.x,b.position.y,b.position.z); }
    ride();
    let aboard=0;
    for(let i=0;i<9000&&!g.noticed(R.id);i++){
      g.tick(1/60,false);
      if(a.onCarroza()) aboard++;
      else ride();
    }
    R.note='aboardFrames='+aboard+' parked='+a.carrozaParked();
    R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
  });
  out['quay/sit'] = await page.evaluate(() => {
    const g=window.__capy; g.biome.switchTo('quay');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.quay, b=g.capy.body, R={id:'let-her-sit'};
    function helm(){ const h=a.boat.helm;
      b.position.set(h.x, h.y+0.5, h.z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(b.position.x,b.position.y,b.position.z); }
    helm();
    for(let i=0;i<90;i++){ g.input.action=true; g.input.actionPressed=(i===0); g.tick(1/60,false); }
    g.input.action=false; g.input.actionPressed=false;
    R.note='atHelm='+g.capy.atHelm+' prog='+a.voyageProgress().toFixed(2);
    // drive north until we are in the middle of the run
    let w=0;
    while(a.voyageProgress()<0.4 && w<36000){
      g.input.z=-1; g.input.x=0;
      g.tick(1/60,false); w++;
      if(!g.capy.atHelm) helm();
    }
    g.input.z=0; g.input.x=0;
    R.note+=' drove='+w+' prog2='+a.voyageProgress().toFixed(2)+' sp='+(a.boat.speed||0).toFixed(2);
    for(let i=0;i<5400&&!g.noticed(R.id);i++){ g.input.z=0; g.input.x=0; g.tick(1/60,false); }
    R.note+=' end='+a.voyageProgress().toFixed(2)+' sp2='+(a.boat.speed||0).toFixed(2)+
            ' helm='+g.capy.atHelm;
    R.got=g.noticed(R.id); R.err=g.state.lastError||null; return R;
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-fire7.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), out);
}
