async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Equal'); await page.waitForTimeout(7000);
  // walk inland toward the palm line, then pull the camera back so the crowns
  // come into frame at all
  await page.keyboard.down('KeyS'); await page.waitForTimeout(2600); await page.keyboard.up('KeyS');
  await page.waitForTimeout(800);
  await page.mouse.move(700, 430);
  for (let i=0;i<8;i++){ await page.mouse.wheel(0, 240); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  const info = await page.evaluate(()=>{
    const g=window.__capy;
    g.tick(0,true);
    fetch('/shot?name=pr-sway-a',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
    const t0=g.state.time; g.state.time=t0+1.35;
    g.tick(0,true);
    fetch('/shot?name=pr-sway-b',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
    g.state.time=t0+2.70;
    g.tick(0,true);
    fetch('/shot?name=pr-sway-c',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
    g.state.time=t0;
    const gu=g.weather.gust();
    return {cam:[+g.camera.position.x.toFixed(1),+g.camera.position.y.toFixed(1),+g.camera.position.z.toFixed(1)],
            capy:[+g.capy.position.x.toFixed(1),+g.capy.position.z.toFixed(1)],
            gust:+Math.hypot(gu.x,gu.z).toFixed(2), err:g.state.lastError?String(g.state.lastError):null};
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-s6.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),info);
}
