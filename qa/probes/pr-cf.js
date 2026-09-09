async page => {
  const KEYS=[['Digit1','sydney'],['Digit0','venice']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(4000);
    // 60 s of REAL clock with real input, not a hand-driven loop
    for(let s=0;s<6;s++){
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2600); await page.keyboard.up('KeyW');
      await page.keyboard.press('Space'); await page.waitForTimeout(1200);
      await page.keyboard.down('KeyA'); await page.waitForTimeout(2600); await page.keyboard.up('KeyA');
      await page.keyboard.press('KeyQ'); await page.waitForTimeout(1600);
      await page.keyboard.down('KeyS'); await page.waitForTimeout(2000); await page.keyboard.up('KeyS');
    }
    const r=await page.evaluate((want)=>{
      const g=window.__capy;
      return {want, biome:g.biome.current, t:+g.state.time.toFixed(1),
        lastError: g.state.lastError?String(g.state.lastError):null,
        capyY:+g.capy.position.y.toFixed(2)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-cf.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
