async page => {
  const KEYS=[['Digit0','venice'],['Digit5','cali'],['Equal','palawan'],['Digit1','sydney']];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    await page.mouse.move(700,430);
    for(let k=0;k<10;k++){ await page.mouse.wheel(0,240); await page.waitForTimeout(110); }
    await page.waitForTimeout(1500);
    await page.evaluate((want)=>{
      const g=window.__capy; g.tick(0,true);
      return fetch('/shot?name=pt-wide-'+want,{method:'POST',
        body:g.renderer.domElement.toDataURL('image/png')});
    },KEYS[i][1]);
  }
}
