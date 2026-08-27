async page => {
  const ALL = ['sydney', 'kyoto', 'venice', 'kowloon', 'monaco']
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const rows = []
  for (const name of ALL) {
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      const inp = g.input
      const D = 1 / 60
      const b = g.capy.body
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)

      // wrap the feedback channels
      const sfxLog = []
      const punchLog = []
      const rawSfx = g.sfx, rawPunch = g.punch, rawShake = g.shake
      g.sfx = function (nm, o) { sfxLog.push(nm); return rawSfx.call(g, nm, o) }
      g.punch = function (a) { punchLog.push(+a.toFixed(3)); return rawPunch.call(g, a) }
      g.shake = function (a) { punchLog.push('shake' + (+a).toFixed(3)); return rawShake.call(g, a) }

      let sx = 0, sz = 0
      function T (k) {
        for (let i = 0; i < k; i++) {
          inp.x = sx; inp.z = sz; inp.run = true; inp.camYaw = 0
          inp.jump = false; inp.jumpPressed = false; inp.action = false
          g.tick(D, false)
        }
      }
      function spd () { return Math.hypot(b.velocity.x, b.velocity.z) }

      // Sweep bearings until one finds a wall: full sprint, and the speed
      // collapses while the stick is still hard over.
      const hits = []
      for (let a = 0; a < 16 && hits.length < 3; a++) {
        const th = a * Math.PI / 8
        const y = (api && api.terrainHeight) ? api.terrainHeight(sp.x, sp.z) : 0
        b.position.set(sp.x, y + 0.6, sp.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        sx = Math.sin(th); sz = Math.cos(th)
        T(60)                                  // get up to speed
        if (spd() < 5.5) continue              // never got going: not a clean run
        sfxLog.length = 0; punchLog.length = 0
        let vBefore = spd(), hitAt = -1
        for (let i = 0; i < 150; i++) {
          T(1)
          const s = spd()
          if (hitAt < 0 && vBefore > 5.5 && s < 0.35 * vBefore) { hitAt = i; break }
          vBefore = Math.max(vBefore, s)
        }
        if (hitAt < 0) continue
        T(30)                                   // let any delayed feedback land
        hits.push({ bearing: +(th * 57.3).toFixed(0), vIn: +vBefore.toFixed(2),
                    vOut: +spd().toFixed(2),
                    sfx: sfxLog.slice(0, 8), fb: punchLog.slice(0, 8) })
      }
      g.sfx = rawSfx; g.punch = rawPunch; g.shake = rawShake
      sx = 0; sz = 0; T(20)
      return { biome: g.biome.current, hits: hits }
    }, name))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-bonk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
