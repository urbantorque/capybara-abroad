async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = {}
  for (const bio of ['kyoto','cali','rio']) {
    await page.evaluate((b) => {
      const g = window.__capy
      g.biome.switchTo(b)
      g.state.lastError = null
      const S = g.biome.spawnOf(b)
      const bd = g.capy.body
      bd.position.set(S.x, S.y, S.z); bd.velocity.set(0,0,0)
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
    }, bio)
    // 20 s of random input
    const keys = ['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','KeyE','KeyZ','KeyX','ShiftLeft']
    for (let k = 0; k < 40; k++) {
      const a = keys[Math.floor(Math.random() * keys.length)]
      await page.keyboard.down(a)
      await page.waitForTimeout(240)
      await page.keyboard.up(a)
    }
    out[bio] = await page.evaluate(() => {
      const g = window.__capy
      const p = g.capy.position
      let nan = 0
      for (const b of g.world.bodies) {
        if (!isFinite(b.position.x) || !isFinite(b.position.y) || !isFinite(b.position.z)) nan++
      }
      return { err: g.state.lastError || null, nan,
               capy: [p.x, p.y, p.z].map(v => +v.toFixed(1)),
               finite: isFinite(p.x) && isFinite(p.y) && isFinite(p.z),
               score: g.state.score, bodies: g.world.bodies.length }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4soak.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
