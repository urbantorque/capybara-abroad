async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['palawan','goreme']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      const keys = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft']
      let bad = 0, voids = 0, nan = 0
      for (let f = 0; f < 3200; f++) {
        if (f % 11 === 0) {
          const k = keys[(Math.random()*keys.length)|0]
          window.dispatchEvent(new KeyboardEvent(Math.random()<0.5?'keydown':'keyup', {code:k, bubbles:true}))
        }
        g.tick(1/60, false)
        const p = g.capy.body.position
        if (!(p.x===p.x && p.y===p.y && p.z===p.z)) { nan++; break }
        if (p.y < -400) voids++
      }
      for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', {code:k, bubbles:true}))
      return { nan, voids, err: g.state.lastError || null,
               pos: [Math.round(g.capy.body.position.x), Math.round(g.capy.body.position.y), Math.round(g.capy.body.position.z)],
               tasksDone: (g.state.tasks && Object.keys(g.state.tasks).length) || 0 }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=zasmoke.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
