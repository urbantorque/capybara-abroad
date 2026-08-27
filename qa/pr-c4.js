async page => {
  const KEYS=[['Digit1','sydney'],['Digit0','venice'],['Minus','kowloon']];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    await page.evaluate((want)=>{
      const g=window.__capy;
      g.state.noContact=true;  g.tick(0,true);
      const off=g.renderer.domElement.toDataURL('image/png');
      fetch('/shot?name=pr-off-'+want,{method:'POST',body:off});
      g.state.noContact=false; g.tick(0,true);
      const on=g.renderer.domElement.toDataURL('image/png');
      return fetch('/shot?name=pr-on-'+want,{method:'POST',body:on});
    },KEYS[i][1]);
  }
}
