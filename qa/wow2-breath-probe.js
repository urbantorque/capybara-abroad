async page => {
  // ROADMAP-WOW2 V2.3 probe — a cold chapter: walk the animal beside the
  // nearest local, count breath puffs over 20 s (npc audit + the burst
  // pool's own audit), and a close pinned lens the frame after a puff.
  const CHAP = 'iceland'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty': rung 0 held
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  await page.evaluate((n) => window.__capy.hud.cross(n), CHAP); await page.waitForTimeout(9500)
  const out = { errs, chap: CHAP }
  out.r = await page.evaluate(async () => {
    const g = window.__capy, live = g.biome.current
    const L = g.locals.filter(l => l.biome === live && l.fig)
    const cp = g.capy.position
    let best = null, bd = 1e9
    for (const l of L) { const d = Math.hypot(l.x - cp.x, l.z - cp.z); if (d < bd) { bd = d; best = l } }
    g.peopleAudit.umbrella(true)
    const nums = o => { const r = {}; if (o) for (const k in o) if (typeof o[k] === 'number') r[k] = o[k]; return r }
    const b0 = g.weather.burstAudit ? nums(g.weather.burstAudit()) : null
    let shot = false, puffsSeen = 0, last = 0
    for (let t = 0; t < 20 * 60; t++) {
      g.tick(1 / 60, false)
      const n = g.peopleAudit.umbrella().breaths
      if (n > last) {
        last = n; puffsSeen++
        if (!shot) {
          for (let k = 0; k < 8; k++) g.tick(1 / 60, false)   // let it rise a hand's width
          const cam = g.camera.clone()
          const yaw = best.yaw + 0.35
          cam.position.set(best.x + Math.sin(yaw) * 2.6, best.y + 1.7, best.z + Math.cos(yaw) * 2.6)
          cam.lookAt(best.x, best.y + 1.55, best.z)
          cam.updateMatrixWorld(true)
          g.renderer.setRenderTarget(null)
          g.renderer.render(g.scene, cam)
          const d = g.renderer.domElement.toDataURL('image/png')
          await fetch('/shot?name=wow2-breath-' + live, { method: 'POST', body: d.split(',')[1] })
          shot = true
        }
      }
    }
    const b1 = g.weather.burstAudit ? nums(g.weather.burstAudit()) : null
    return { nearest: { x: +best.x.toFixed(1), z: +best.z.toFixed(1), d: +bd.toFixed(1) }, localsInRange: L.filter(l => Math.hypot(l.x - cp.x, l.z - cp.z) < 12).length,
             puffs: g.peopleAudit.umbrella().breaths, puffsSeen, burst0: b0, burst1: b1, shot }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-breath-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
