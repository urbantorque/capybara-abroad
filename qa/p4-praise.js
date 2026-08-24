async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = []
  const jobs = [['kyoto', 0, 'zen-ruin'], ['cali', 0, 'lulada'], ['rio', 2, 'futevolei']]
  for (const j of jobs) {
    await page.evaluate((b) => { window.__capy.biome.switchTo(b) }, j[0])
    await page.waitForTimeout(1200)
    const r = await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.b)[a.i]
      L.cd = 0; L.last = ''
      const bd = g.capy.body
      bd.position.set(L.x + 3, L.y + 0.8, L.z + 3); bd.velocity.set(0,0,0)
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
      return null
    }, { b: j[0], i: j[1] })
    await page.waitForTimeout(400)
    await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.b)[a.i]
      L.cd = 0; L.last = ''
      g.completeTask(a.t)
    }, { b: j[0], i: j[1], t: j[2] })
    await page.waitForTimeout(700)
    out.push(await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.b)[a.i]
      return { k: a.b + '#' + a.i + ' ' + a.t, last: L.last, err: g.state.lastError || null }
    }, { b: j[0], i: j[1], t: j[2] }))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4praise.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
