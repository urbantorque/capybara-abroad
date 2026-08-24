async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const marks = { kyoto: [3, 4], cali: [2, 7], rio: [0, 1] }
  const said = {}
  for (const bio of ['kyoto','cali','rio']) {
    await page.evaluate((b) => { window.__capy.biome.switchTo(b); window.__capy.state.lastError = null }, bio)
    await page.waitForTimeout(1200)
    for (let k = 0; k < 70; k++) {
      await page.evaluate((a) => {
        const g = window.__capy
        const L = g.locals.filter(l => l.biome === a.b)
        const A = L[a.i], B = L[a.j]
        const mx = (A.x + B.x) * 0.5, mz = (A.z + B.z) * 0.5
        const bd = g.capy.body
        bd.position.set(mx + 11, A.y + 0.8, mz + 11); bd.velocity.set(0,0,0)
        bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
      }, { b: bio, i: marks[bio][0], j: marks[bio][1] })
      await page.waitForTimeout(300)
    }
    said[bio] = await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.b)
      return { a: L[a.i].last, b: L[a.j].last, err: g.state.lastError || null }
    }, { b: bio, i: marks[bio][0], j: marks[bio][1] })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4ex.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, said)
}
