async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  const out = []
  for (const i of [4, 5, 6]) {
    await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === 'cali')[a]
      L.cd = 0; L.was = false; L.last = ''
    }, i)
    for (let k = 0; k < 8; k++) {
      await page.evaluate((a) => {
        const g = window.__capy
        const L = g.locals.filter(l => l.biome === 'cali')[a]
        const bd = g.capy.body
        bd.position.set(L.x + 1.5, L.y + 0.7, L.z + 1.5); bd.velocity.set(0,0,0)
        bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
      }, i)
      await page.waitForTimeout(250)
    }
    out.push(await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === 'cali')[a]
      const cp = g.capy.position
      return { i: a, last: L.last, cd: +L.cd.toFixed(1), was: L.was, hasGroup: !!L.group,
               dist: +Math.hypot(cp.x - L.x, cp.z - L.z).toFixed(1),
               capyY: +cp.y.toFixed(1), Ly: +L.y.toFixed(1) }
    }, i))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4chat3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
