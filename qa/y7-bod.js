async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const hist = {}
    let total = 0
    for (const b of g.world.bodies) {
      total++
      const t = b.shapes.map(s => s.constructor.name).join('+')
      const k = (b.mass > 0 ? 'dyn ' : b.type === 4 ? 'kin ' : 'sta ') + b.shapes.length + 'x ' + (b.shapes[0] ? b.shapes[0].constructor.name : '?')
      hist[k] = (hist[k]||0)+1
    }
    return { total, hist }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=y7bod.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
