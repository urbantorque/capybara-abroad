async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const names = ['pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    const spots = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      g.state.lastError = null
      return (g.locals || []).filter(l => l.biome === name).map(l => [l.x, l.y, l.z, !!l.group])
    }, n)
    const rows = []
    for (let i = 0; i < spots.length; i++) {
      const r = await page.evaluate((a) => {
        const g = window.__capy, b = g.capy.body
        b.position.set(a.s[0] + 2.0, a.s[1] + 1.2, a.s[2] + 2.0); b.velocity.set(0,0,0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        const L = g.locals.filter(l => l.biome === a.n)[a.i]
        L.cd = 0; L.was = false
        return null
      }, { s: spots[i], n, i })
      await page.waitForTimeout(1300)
      const said = await page.evaluate(() => {
        const bubs = [...document.querySelectorAll('#hud div')].filter(d => d.style.borderRadius === '13px' && d.style.display === 'block')
        return bubs.map(b => b.textContent).join(' | ')
      })
      rows.push({ at: spots[i].slice(0, 3).map(v => Math.round(v)), grp: spots[i][3], said })
    }
    out[n] = { n: spots.length, rows, err: await page.evaluate(() => window.__capy.state.lastError || null) }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=Yauditlocals.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
