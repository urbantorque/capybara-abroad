async page => {
  const KEYS=[['Digit8','sahara'],['Digit6','rio']];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    await page.mouse.move(700,430);
    for(let k=0;k<8;k++){ await page.mouse.wheel(0,240); await page.waitForTimeout(110); }
    await page.waitForTimeout(1400);
    await page.evaluate((want)=>{
      const g=window.__capy;
      g.tick(0,true);
      fetch('/shot?name=pr-sw-'+want+'-a',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
      const t0=g.state.time; g.state.time=t0+1.6; g.tick(0,true);
      fetch('/shot?name=pr-sw-'+want+'-b',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
      g.state.time=t0; g.tick(0,true);
    },KEYS[i][1]);
  }
}
