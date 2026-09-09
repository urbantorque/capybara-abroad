async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500); await page.keyboard.press('Space'); await page.waitForTimeout(3000);
  await page.evaluate(()=>{const g=window.__capy; try{g.hud.cross('venice');}catch(e){g.biome.switchTo('venice');}});
  await page.waitForTimeout(4800);
  await page.evaluate(()=>{
    const g=window.__capy; const p=g.capy.position;
    const pr=g.physics.spawnProp('cone', p.x+0.6, p.z+0.2);
    if(pr) g.physics.grab(pr);
    window.__tl=[]; const t0=performance.now();
    (function step(){
      const h=g.capy.heldProp;
      window.__tl.push({t:+((performance.now()-t0)/1000).toFixed(2), b:g.biome.current,
        h: h?h.type:null, ma: !!g.capy.mouthAnchor, ta: g.physics.travelAudit(), a: g.physics.travelAudit().why});
      if(performance.now()-t0<9000) requestAnimationFrame(step);
    })();
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const g=window.__capy; try{g.hud.cross('goreme');}catch(e){g.biome.switchTo('goreme');}});
  await page.waitForTimeout(9000);
  const tl = await page.evaluate(()=>window.__tl.filter((r,i)=>i%6===0));
  await page.evaluate(async p=>{await fetch('/shot?name=DBG',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(p))))});}, tl);
}
