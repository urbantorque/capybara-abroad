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
      const b = g.capy.body
      const api = g[q.biome]
      const y0 = api.terrainHeight(q.from[0], q.from[1])
      b.position.set(q.from[0], y0 + 0.6, q.from[1]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(400)
      const held = new Set()
      const setKeys = (want) => {
        for (const k of ['KeyW','KeyA','KeyS','KeyD']) {
          if (want.has(k) && !held.has(k)) { down(k); held.add(k) }
          if (!want.has(k) && held.has(k)) { up(k); held.delete(k) }
        }
      }
      const t0 = performance.now()
      let best = 1e9, stuckAt = null
      const trail = []
      while (performance.now() - t0 < q.secs * 1000) {
        const p = g.capy.position
        const dx = q.to[0] - p.x, dz = q.to[1] - p.z
        const d = Math.hypot(dx, dz)
        if (d < best) best = d
        if (d < 2.5) break
        // camera-relative: the yaw the walk vector must be expressed in
        const yaw = g.input.camYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)     // forward in world
        const rx = Math.cos(yaw), rz = -Math.sin(yaw)      // right in world
        const f = (dx * fx + dz * fz) / d, r = (dx * rx + dz * rz) / d
        const want = new Set()
        if (f > 0.35) want.add('KeyW'); else if (f < -0.35) want.add('KeyS')
        if (r > 0.35) want.add('KeyD'); else if (r < -0.35) want.add('KeyA')
        setKeys(want)
        await sleep(220)
        trail.push([+p.x.toFixed(1), +p.z.toFixed(1)])
      }
      setKeys(new Set())
      const p = g.capy.position
      return { best: +best.toFixed(1), end: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               reached: best < 2.5, trail: trail.slice(-8) }
    }, { biome, from, to, secs })
  }
  const out = {}
  // Venice: the square -> through the sotoportego -> the campo (the ONE way out on foot)
  out.venSoto = await walk('venice', [-4, -28], [-20, -31], 22)
  out.venCampo = await walk('venice', [-22, -31], [-54, -24], 26)
  // Venice: under the arcade, which used to be solid
  out.venArcade = await walk('venice', [-12, -20], [-18, -30], 16)
  // Kowloon: the street -> the market lane -> the stalls
  out.hkMarket = await walk('kowloon', [4, 18], [29, 18], 22)
  // Kowloon: the whole street down to the pier
  out.hkPier = await walk('kowloon', [0, 40], [0, -63], 40)
  await page.evaluate(async (o) => { await fetch('/shot?name=s3walk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
