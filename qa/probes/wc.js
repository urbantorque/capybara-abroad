async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('venice')
    for (let i=0;i<30;i++) g.tick(1/60,false)
    const v = g.venice
    const ls = (g.locals||[]).filter(r=>r.biome==='venice').map(r=>({x:+r.group.position.x.toFixed(1),y:+r.group.position.y.toFixed(2),z:+r.group.position.z.toFixed(1),l:(r.lines&&r.lines[0]||'').slice(0,20)}))
    return { locals: ls, water: +v.tideY().toFixed(2) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wc.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
