async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['rio','iceland']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      const inp = g.input
      let bad = [], nan = 0, voids = 0
      let seed = 12345
      const rnd = () => (seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff
      for (let i = 0; i < 9000; i++) {
        if (i % 40 === 0) {
          inp.x = rnd()*2-1; inp.z = rnd()*2-1
          inp.run = rnd() > 0.5
          inp.actionPressed = rnd() > 0.9; inp.honkPressed = rnd() > 0.9
          inp.jumpPressed = rnd() > 0.85
          inp.camYaw = rnd()*6.28
        } else { inp.actionPressed = false; inp.honkPressed = false; inp.jumpPressed = false }
        try { g.tick(1/60, false) } catch (e) { bad.push(String(e).slice(0,160)); break }
        const p = g.capy.body.position
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { nan++; break }
        if (p.y < -60) { voids++; b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0) }
      }
      return { bad, nan, voids, err: g.state.lastError || null, tasks: g.state.done ? Object.keys(g.state.done).length : -1 }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=y67soak.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
