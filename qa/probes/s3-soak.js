async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['drift','venice','kowloon']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(400)
      let s = 987654 ^ name.length * 7919
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      let nan = 0, low = 0, fps = 0, frames = 0
      const t0 = performance.now()
      let last = t0
      while (performance.now() - t0 < 18000) {
        if (rnd() < 0.10) {
          const k = KEYS[(rnd() * KEYS.length) | 0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
        }
        await sleep(16)
        frames++
        const p = g.capy.position, v = g.capy.body.velocity
        if (!(p.x===p.x&&p.y===p.y&&p.z===p.z)) nan++
        if (!(v.x===v.x&&v.y===v.y&&v.z===v.z)) nan++
        if (p.y < -80) low++
      }
      for (const k of held) up(k)
      const dur = (performance.now() - t0) / 1000
      return { nan, low, frames, fps: +(frames/dur).toFixed(1),
               lastError: g.state.lastError ? String(g.state.lastError).slice(0,300) : null,
               end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=s3soak.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
