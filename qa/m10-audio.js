async page => {
  // m10-audio.js — three cues that were built and could not be heard.
  //
  //   1. the elevation shelf, unreachable past 9.63 m because of an `else`
  //   2. the back lowpass, resonant at its own corner because Q was never set
  //   3. the wet step, which only ever asked the weather
  //
  // audioProbe now publishes what the branch BUILT (`lp`, `shelf`) beside what
  // went into it (`back`, `up`). The whole point of the run is that the second
  // pair was always right while the first pair did not exist.
  const out = { ring: [], wade: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  // ---- the ring. Same distance, eight bearings, and then straight up. ----
  out.ring = await page.evaluate(() => {
    const g = window.__capy
    const p = g.hud.audioProbe
    const ear = p(0, 0, 0).ear
    const rows = []
    // the camera's own forward bearing, so "in front" means in front
    const cam = g.camera
    const f = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const fx = f.x, fz = f.z
    const L = Math.hypot(fx, fz) || 1
    for (const d of [4, 9, 20, 55, 80]) {
      for (const [tag, s] of [['front', 1], ['behind', -1]]) {
        const r = p(ear.x + (fx / L) * d * s, ear.y, ear.z + (fz / L) * d * s, 4, 200)
        rows.push({ d: d, at: tag, back: r.back, up: r.up,
                    lp: Math.round(r.lp), shelf: r.shelf, q: r.lpQ })
      }
    }
    // ...and overhead, at the distances where the `else` used to win
    for (const d of [4, 12, 30, 60]) {
      const r = p(ear.x, ear.y + d, ear.z, 4, 200)
      rows.push({ d: d, at: 'above', back: r.back, up: r.up,
                  lp: Math.round(r.lp), shelf: r.shelf, q: r.lpQ })
    }
    return rows
  })

  // ---- the wade. Walk the animal down a beach and watch `wet`. ----------
  await page.evaluate((n) => { window.__capy.hud.cross(n) }, 'manly')
  await page.waitForTimeout(9000)
  // A TELEPORT PRODUCES NO FOOTSTEPS. The first cut of this wrote the body
  // three times and read `steps = 0` at every station — correct, and nothing to
  // do with the feature: the footfall is driven by gait speed, and a written
  // position has none. It has to WALK in, so: find the sea, point the rig at
  // it, and hold W. `input.camYaw` is the bearing from the animal TO the camera
  // (trap 26), so walking toward a target at (dx, dz) wants atan2(-dx, -dz),
  // and it is re-asserted while W is held because the yaw is damped and drifts.
  const aim = await page.evaluate(() => {
    const g = window.__capy
    const env = (g.biome.current === 'sydney' ? g.env : g[g.biome.current]) || null
    if (!env || typeof env.isOverWater !== 'function') return { ok: false }
    const p = g.capy.position
    let best = null, bd = 1e9
    for (let a = 0; a < 64; a++) {
      const th = a * Math.PI / 32
      for (let r = 6; r <= 90; r += 3) {
        const x = p.x + Math.sin(th) * r, z = p.z + Math.cos(th) * r
        if (env.isOverWater(x, z)) { if (r < bd) { bd = r; best = { x: x, z: z } } break }
      }
    }
    if (!best) return { ok: false }
    const dx = best.x - p.x, dz = best.z - p.z
    window.__wadeYaw = Math.atan2(-dx, -dz)
    window.__wadeT = setInterval(function () { g.input.camYaw = window.__wadeYaw }, 120)
    return { ok: true, water: [+best.x.toFixed(1), +best.z.toFixed(1)], range: +bd.toFixed(1) }
  })
  out.aim = aim
  await page.waitForTimeout(400)
  await page.keyboard.down('KeyW')
  out.wade = await page.evaluate(() => {
    const g = window.__capy
    // Wrap the step voice rather than guessing: `wet` is written into a shared
    // options object one line before the call, so the only honest reading is
    // the value the call was actually handed.
    const raw = g.sfx
    const seen = []
    g.sfx = function (name, opts) {
      if (name === 'step' && opts) seen.push({ wet: +(opts.wet || 0).toFixed(3),
                                               pitch: +(opts.pitch || 0).toFixed(2) })
      return raw.call(g, name, opts)
    }
    return new Promise(function (done) {
      const env = (g.biome.current === 'sydney' ? g.env : g[g.biome.current]) || null
      const b = g.capy.body
      // Every step of a fourteen-second walk into the sea, tagged with how deep
      // the foot was when it landed. One row per second-and-a-bit window.
      const rows = []
      let k = 0
      const tick = setInterval(function () {
        const p = b.position
        const wy = (env && typeof env.waterYAt === 'function') ? env.waterYAt(p.x, p.z)
                 : (env && typeof env.waterY === 'function' ? env.waterY() : 0)
        const over = !!(env && typeof env.isOverWater === 'function' && env.isOverWater(p.x, p.z))
        rows.push({ t: ++k, n: seen.length,
                    wet: seen.length ? +Math.max.apply(null, seen.map(s => s.wet)).toFixed(3) : -1,
                    pitch: seen.length ? seen[seen.length - 1].pitch : -1,
                    over: over, foot: +(p.y - 0.34).toFixed(2), xz: [+p.x.toFixed(0), +p.z.toFixed(0)],
                    depth: over ? +(wy - (p.y - 0.34)).toFixed(2) : -9 })
        seen.length = 0
        if (k >= 24) {
          clearInterval(tick)
          g.sfx = raw
          if (window.__wadeT) clearInterval(window.__wadeT)
          done(rows)
        }
      }, 1300)
    })
  })
  await page.keyboard.up('KeyW')

  await page.evaluate(async (o) => {
    await fetch('/shot?name=m10-audio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
