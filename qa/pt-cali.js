async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit5'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, c=g.cali;
    const out={api:c?Object.keys(c).slice(0,24):null, capy:[+g.capy.position.x.toFixed(1),+g.capy.position.z.toFixed(1)]};
    const rows=[];
    for(let z=-34; z<=14; z+=2){
      const y=c.terrainHeight(-16,z);
      rows.push([z, +y.toFixed(2), c.isOverWater? (c.isOverWater(-16,z)?'W':'.') : '?']);
    }
    out.alongZ = rows;
    const rx=[];
    for(let x=-60; x<=20; x+=5) rx.push([x, +c.terrainHeight(x,-18).toFixed(2)]);
    out.alongX = rx;
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pt-cali.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),r);
}
