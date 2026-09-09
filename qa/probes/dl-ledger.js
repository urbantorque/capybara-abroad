async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const g=window.__capy; g.biome.switchTo('kowloon');
    for(let i=0;i<60;i++) g.tick(1/60,false);
    const a=g.kowloon, b=g.capy.body;
    function put(x,z){ const y=a.terrainHeight(x,z)+0.45;
      b.position.set(x,y,z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(x,y,z); }
    let w=0; while(a.show()<0.55&&w<36000){ g.tick(1/60,false); w++; }
    put(30,18);
    for(let i=0;i<700&&!g.noticed('missed-the-show');i++){ g.tick(1/60,false);
      const p=g.capy.position; if(Math.hypot(p.x-30,p.z-18)>0.9) put(30,18); }
  });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(600);
  const btn = await page.$('button');
  const out = await page.evaluate(() => {
    const g=window.__capy;
    const btns=[...document.querySelectorAll('button')].filter(b=>/laid out/.test(b.textContent));
    if(btns[0]) btns[0].click();
    return { noticed: g.noticed('missed-the-show'), count: g.noticed() };
  });
  await page.waitForTimeout(900);
  const dom = await page.evaluate(() => {
    const rows=[...document.querySelectorAll('.capyui-ledfind')].map(e=>e.textContent);
    const names=[...document.querySelectorAll('.capyui-ledname')].map(e=>e.textContent);
    return { finds: rows, places: names };
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-ledger.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}), {out, dom});
}
