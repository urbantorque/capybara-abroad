async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('drift')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const r = { locals: null, found: [] }
    if (g.npcsApi && g.npcsApi.locals) r.locals = g.npcsApi.locals.length
    g.scene.traverse(o => {
      if (o.isGroup && o.children.length >= 6 && o.position.y > 70 && o.position.y < 120)
        r.found.push({ p:[+o.position.x.toFixed(1),+o.position.y.toFixed(1),+o.position.z.toFixed(1)], vis:o.visible, n:o.children.length })
    })
    r.keys = Object.keys(g).filter(k => /npc|local/i.test(k))
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4loc.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
