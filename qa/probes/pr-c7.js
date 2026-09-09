async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(6000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    return { keys:Object.keys(g).slice(0,60), hasTHREE:!!g.THREE, props:g.props?g.props.length:-1,
             npcs:g.npcs?g.npcs.length:-1, p0:g.props&&g.props[0]?Object.keys(g.props[0]):null };
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c7.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
