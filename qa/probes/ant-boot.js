async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const boot = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, biome: g.biome.current, err: g.state.lastError || null,
             hasApi: !!g.antarctic, chapters: (typeof chapterCount === 'function') ? 0 : 0 }
  })
  const enter = await page.evaluate(() => {
    const g = window.__capy
    try {
      g.biome.switchTo('antarctic')
      const sp = g.biome.spawnOf('antarctic')
      g.capy.body.position.set(sp.x, sp.y, sp.z)
      g.capy.body.velocity.set(0, 0, 0)
    } catch (e) { return { threw: String(e && e.stack || e) } }
    return { ok: true }
  })
  await page.waitForTimeout(4000)
  const state = await page.evaluate(() => {
    const g = window.__capy
    const a = g.antarctic
    const p = g.capy.position
    return {
      biome: g.biome.current,
      err: g.state.lastError || null,
      bodies: g.world.bodies.length,
      capy: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      terrainAtCapy: +a.terrainHeight(p.x, p.z).toFixed(2),
      slipAtCapy: +a.groundSlip(p.x, p.z).toFixed(2),
      swimming: !!g.capy.swimming,
      grounded: !!g.capy.grounded,
      boat: [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1)],
      pod: (() => { const q = a.pod(); return [+q.x.toFixed(1), +q.z.toFixed(1)] })(),
      saves: g.state.solverSaves || 0,
      map: g.hud.mapMarkAudit ? g.hud.mapMarkAudit() : null,
    }
  })
  // walk about for 12 s with random-ish input and count solver contacts on the capy
  await page.evaluate(() => {
    const g = window.__capy
    window.__cc = 0
    window.__ccTimer = setInterval(() => {
      const b = g.capy.body, cs = g.world.contacts
      for (let i = 0; i < cs.length; i++) if (cs[i].bi === b || cs[i].bj === b) window.__cc++
    }, 16)
  })
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('w'); await page.waitForTimeout(800); await page.keyboard.up('w')
    await page.keyboard.press('q')
    await page.keyboard.down(i % 2 ? 'a' : 'd'); await page.waitForTimeout(500); await page.keyboard.up(i % 2 ? 'a' : 'd')
    await page.keyboard.press(' ')
    await page.waitForTimeout(300)
  }
  const walked = await page.evaluate(() => {
    const g = window.__capy
    clearInterval(window.__ccTimer)
    const p = g.capy.position
    return { contacts: window.__cc, err: g.state.lastError || null,
             capy: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
             saves: g.state.solverSaves || 0, swimming: !!g.capy.swimming }
  })
  // sample the ice / slip / terrain fields on a coarse grid so the shape of the
  // world can be checked without a picture
  const fields = await page.evaluate(() => {
    const a = window.__capy.antarctic
    const out = { land: 0, water: 0, slipHi: 0, slipMid: 0, leadCells: 0, packCells: 0, nan: 0 }
    for (let x = -210; x <= 210; x += 10) {
      for (let z = -500; z <= 120; z += 10) {
        const h = a.terrainHeight(x, z)
        if (!(h === h)) { out.nan++; continue }
        if (h > a.waterLevel) {
          out.land++
          const s = a.groundSlip(x, z)
          if (s > 0.7) out.slipHi++
          else if (s > 0.25) out.slipMid++
        } else {
          out.water++
          const d = a.packAt(x, z)
          if (d < 0.12) out.leadCells++
          if (d > 0.6) out.packCells++
        }
      }
    }
    return out
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antboot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { boot, enter, state, walked, fields })
}
