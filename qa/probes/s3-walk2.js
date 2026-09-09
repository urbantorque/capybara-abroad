async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const walk = async (biome, from, to, secs) => {
    return await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      if (g.biome.current !== q.biome) g.biome.switchTo(q.biome)
      const b = g.capy.body, api = g[q.biome]
      b.position.set(q.from[0], api.terrainHeight(q.from[0], q.from[1]) + 0.6, q.from[1])
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(400)
      const held = new Set()
      const setKeys = (want) => {
        for (const k of ['KeyW','KeyA','KeyS','KeyD']) {
          if (want.has(k) && !held.has(k)) { down(k); held.add(k) }
          if (!want.has(k) && held.has(k)) { up(k); held.delete(k) }
        }
      }
      const t0 = performance.now()
      let best = 1e9
      while (performance.now() - t0 < q.secs * 1000) {
        const p = g.capy.position
        const dx = q.to[0] - p.x, dz = q.to[1] - p.z, d = Math.hypot(dx, dz)
        if (d < best) best = d
        if (d < 1.5) break
        const yaw = g.input.camYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw)
        const f = (dx*fx + dz*fz)/d, r = (dx*rx + dz*rz)/d
        const want = new Set()
        if (f > 0.3) want.add('KeyW'); else if (f < -0.3) want.add('KeyS')
        if (r > 0.3) want.add('KeyD'); else if (r < -0.3) want.add('KeyA')
        setKeys(want)
        await sleep(200)
      }
      setKeys(new Set())
      const p = g.capy.position
      return { best: +best.toFixed(1), end: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], ok: best < 1.5 }
    }, { biome, from, to, secs })
  }
  const out = {}
  out.intoLoggia = await walk('venice', [-12, -20], [-18.5, -20], 16)
  out.alongLoggia = await walk('venice', [-18, -20], [-18, -10], 16)
  out.cafe = await walk('venice', [-12, -14], [-17.8, -20], 18)
  out.eastArcade = await walk('venice', [4, -30], [10.5, -30], 16)
  await page.evaluate(async (o) => { await fetch('/shot?name=s3walk2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
