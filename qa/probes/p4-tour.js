async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const spots = [
    ['rio', 'r-ave',   0, 30],
    ['rio', 'r-lapa',  -14, 84],
    ['rio', 'r-arp',   -74, -10],
    ['cali','c-street', -10, 40],
    ['cali','c-floor', -22, 52],
  ]
  for (const s of spots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a.b) g.biome.switchTo(a.b)
      const api = g[a.b]
      const y = api.terrainHeight(a.x, a.z)
      const bd = g.capy.body
      bd.position.set(a.x, y + 1.2, a.z); bd.velocity.set(0,0,0)
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
    }, { b: s[0], x: s[2], z: s[3] })
    await page.waitForTimeout(3000)
    const buf = await page.screenshot({ type: 'png' })
    await page.evaluate(async (a) => { await fetch('/shot?name=' + a.n, { method: 'POST', body: a.d }) }, { n: s[1], d: 'data:image/png;base64,' + buf.toString('base64') })
  }
}
