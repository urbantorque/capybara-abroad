async page => {
  await page.setViewportSize({ width: 960, height: 600 })
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const want = { sahara: 0, kowloon: 0, venice: 0, manly: 0, kyoto: 1, goreme: 0 }
  for (const [n, idx] of Object.entries(want)) {
    await page.evaluate((a) => {
      const g = window.__capy
      g.biome.switchTo(a.n)
    }, { n })
    await page.waitForTimeout(600)
    await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.n)[a.i]
      // stand the animal SOUTH of the local and point the rig north at them
      const b = g.capy.body
      b.position.set(L.x, L.y + 1.2, L.z - 4.5); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = Math.PI
      L.cd = 0; L.was = false
    }, { n, i: idx })
    await page.waitForTimeout(3000)
    const buf = await page.screenshot()
    await page.evaluate(async (a) => { await fetch('/shot?name=loc-' + a.n, { method: 'POST', body: 'data:image/png;base64,' + a.d }) }, { d: buf.toString('base64'), n })
  }
}
