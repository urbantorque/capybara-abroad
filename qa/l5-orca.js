async page => {
  // L5 M4 — THE ORCA POD: the escort's seconds do not tick the marquee (ride
  // resets at the run), the bull's breach in the run is held and framed
  // (timeScale, camInfo.shot, sparks), the tick at nine seconds of the run.
  // The animal to the helm, E, W held; podForce puts the pod on the boat.
  // qa/l5-orca.json; qa/l5-orca-breach.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('antarctic') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => { const g = window.__capy, h = g.antarctic.boat.helm, b = g.capy.body; b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(800)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
  out.helm = await page.evaluate(() => window.__capy.antarctic.boat.atHelm)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(7500)
  out.boatZ = await page.evaluate(() => +window.__capy.antarctic.boat.position.z.toFixed(1))
  await page.evaluate(() => window.__capy.antarctic.podForce())
  const rows = []
  let shot = false, held = null
  for (let k = 0; k < 160; k++) {
    await page.waitForTimeout(150)
    const d = await page.evaluate(() => { const g = window.__capy, p = g.antarctic.podDebug(), b = g.antarctic.boat
      let rel = Math.atan2(p.podX - b.position.x, p.podZ - b.position.z) - b.heading
      while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2
      return { st: p.st, stT: p.stateT, ride: p.ride, gap: p.gap, rel: +rel.toFixed(2), sp: +Math.abs(b.speed).toFixed(1), ts: +(g.state.timeScale || 1).toFixed(2), shot: +g.camInfo.shot.toFixed(2), sparks: g.sparksLive(), done: g.taskDone('orca-ride') } })
    rows.push(d)
    // steer at the pod while it runs: A/D by the bearing off the bow
    const want = d.st === 'run' && Math.abs(d.rel) > 0.08 ? (d.rel > 0 ? 'KeyA' : 'KeyD') : null
    if (want !== held) { if (held) await page.keyboard.up(held); if (want) await page.keyboard.down(want); held = want }
    if (!shot && d.st === 'run' && d.ts < 0.95) { shot = true; await page.screenshot({ path: 'qa/l5-orca-breach.png', timeout: 90000 }) }
    if (d.done && k > 5) { await page.waitForTimeout(800); break }
    if (d.st === 'patrol' && k > 20) break
  }
  if (held) await page.keyboard.up(held)
  await page.keyboard.up('KeyW')
  out.rows = rows.filter((r, i) => i % 3 === 0 || r.ts < 0.95 || r.done)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-orca.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
