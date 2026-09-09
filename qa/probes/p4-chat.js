async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = {}
  for (const bio of ['kyoto','cali','rio']) {
    await page.evaluate((b) => { const g = window.__capy; g.biome.switchTo(b); g.state.lastError = null }, bio)
    await page.waitForTimeout(1000)
    const n = await page.evaluate((b) => window.__capy.locals.filter(l => l.biome === b).length, bio)
    const said = []
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < n; i++) {
        await page.evaluate((a) => {
          const g = window.__capy
          const L = g.locals.filter(l => l.biome === a.b)[a.i]
          L.cd = 0; L.was = false
          const bd = g.capy.body
          bd.position.set(L.x + 2.0, L.y + 1.2, L.z + 2.0)
          bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
        }, { b: bio, i })
        await page.waitForTimeout(420)
        const t = await page.evaluate(() => {
          const bubs = [...document.querySelectorAll('#hud div')].filter(d => d.style.borderRadius === '13px' && d.style.display === 'block')
          return bubs.map(b => b.textContent).join(' | ')
        })
        said.push(i + ': ' + t)
      }
    }
    out[bio] = { n, said, err: await page.evaluate(() => window.__capy.state.lastError || null) }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4chat.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
