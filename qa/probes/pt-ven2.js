async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit0'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, v=g.venice;
    const pts=[[-4,-40],[-4,-30],[-4,-20],[-4,-16],[-4,-14],[-4,-10],[-4,-4],[-4,0],[-4,4],[-4,8],[-12,0],[4,0]];
    const rows=pts.map(p=>({xz:p, y:+v.terrainHeight(p[0],p[1]).toFixed(3),
                            zone:['piazza','piazzetta'].filter(z=>v.inZone(z,p[0],p[1])).join('|')||'-'}));
    return {capyY:+g.capy.position.y.toFixed(2), rows};
  });
  await page.evaluate((o)=>fetch('/shot?name=pt-ven2.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),r);
}
