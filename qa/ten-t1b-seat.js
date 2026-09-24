async page => {
  const RUNG = 3
  const NAME = 'ten-t1b-seat-r' + RUNG
  const PORT = 5192
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate((pf) => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ pf: pf })) } catch (e) {} }, RUNG >= 3 ? 2 : 1)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'monaco') { g.state.journeyMode = 'free'; g.hud.cross('monaco'); await new Promise(r => setTimeout(r, 9000)) } })
  // the wheel, by the harness door, then the real W key
  await page.evaluate((r) => { const g = window.__capy; window.__t1bRung = r; g.state.perfRung = r; g.monaco.raceDebug({ take: true }) }, RUNG)
  await page.keyboard.down('KeyW')
  const out = { rung: RUNG, samples: [], shots: [] }
  const t0 = Date.now()
  let shot = 0
  while (Date.now() - t0 < 150000) {
    const r = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const rows = []
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }))
      for (let k = 0; k < 20; k++) {
        // the governor writes state.perfRung only when its own rung changes, so
        // a write here holds main.js's shed switch where the test wants it
        g.state.perfRung = window.__t1bRung
        await new Promise(res => setTimeout(res, 150))
        let car = null; g.scene.traverse(x => { if (x.name === 'monMeCar') car = x })
        const cw = new T.Vector3(); car.getWorldPosition(cw)
        const cp = g.capy.position, cg = g.capy.group.position
        const race = g.monaco.race()
        // the body is the one the pack and the barrier see
        let body = null
        for (const b of g.world.bodies) if (b.type === 4 && b.shapes.length === 5 && Math.abs(b.position.x - cw.x) < 30 && Math.abs(b.position.z - cw.z) < 30 && (!body || Math.hypot(b.position.x - cw.x, b.position.z - cw.z) < Math.hypot(body.position.x - cw.x, body.position.z - cw.z))) body = b
        rows.push({ t: +g.state.time.toFixed(2), rung: g.state.perfRung, on: race.on, v: race.v, s: race.s, dist: race.dist, lap: race.lap,
          dCap: +Math.hypot(cp.x - cw.x, cp.z - cw.z).toFixed(2),
          dGrp: +Math.hypot(cg.x - cw.x, cg.z - cw.z).toFixed(2),
          dBody: body ? +Math.hypot(body.position.x - cw.x, body.position.z - cw.z).toFixed(2) : -1,
          car: [+cw.x.toFixed(1), +cw.y.toFixed(1), +cw.z.toFixed(1)], atHelm: !!g.capy.atHelm })
      }
      return rows
    })
    out.samples.push(...r)
    const last = r[r.length - 1]
    if (shot < 2 && last.v > 12) { shot++; const p = 'qa/' + NAME + '-' + shot + '.png'; await page.screenshot({ path: p }); out.shots.push({ p, at: last }) }
    if (last.lap >= 1 || !last.on) break
  }
  await page.keyboard.up('KeyW')
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })))
  const s = out.samples.filter(x => x.on && x.v > 1)
  out.n = s.length
  out.maxCap = Math.max(...s.map(x => x.dCap))
  out.maxGrp = Math.max(...s.map(x => x.dGrp))
  out.meanCap = +(s.reduce((a, x) => a + x.dCap, 0) / Math.max(1, s.length)).toFixed(2)
  out.rungs = [...new Set(out.samples.map(x => x.rung))]
  out.lapDone = out.samples.some(x => x.lap >= 1)
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }) }, { name: NAME, out })
}
