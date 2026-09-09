async page => {
  const KEYS=[['Minus','kowloon'],['Period','monaco']];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(8000);
    await page.evaluate((want)=>{
      const g=window.__capy;
      g.state.noSpill=true;  g.tick(0,true);
      fetch('/shot?name=pt-off-'+want,{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
      g.state.noSpill=false; g.tick(0,true);
      return fetch('/shot?name=pt-on-'+want,{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
    },KEYS[i][1]);
  }
}
