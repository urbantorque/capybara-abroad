async page => {
  const CH = 'pasto'
  const out = { CH, errs: [], log: [], shot: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5195/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() => window.__capy.biome.current)
    if (cur === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  const st = () => page.evaluate(() => {
    const g = window.__capy, c = g.condor, b = c.body.position, p = g.capy.body.position
    const T = g.THREE, v = new T.Vector3(b.x, b.y, b.z).project(g.camera)
    return { t: +g.state.time.toFixed(2), st: c.state, rung: g.state.perfRung, by: +b.y.toFixed(1),
      agl: +(b.y - g.pasto.terrainHeight(b.x, b.z)).toFixed(2), px: +p.x.toFixed(1), pz: +p.z.toFixed(1),
      reach: c.talonInReach(), mounted: c.mounted, framing: +g.framing().toFixed(2),
      inShot: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, fw: +(g.state.flierWhistleT || 0).toFixed(2),
      a: c.condorAudit() }
  })
  out.log.push(await st())
  await page.keyboard.press('KeyQ')
  // the summon: sample the shot at 5 Hz for 7 s, one picture at the framing peak
  let pic = false
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(200)
    const s = await st()
    out.shot.push(s)
    if (!pic && s.a.shots > 0 && s.framing > 0.9) { pic = true; await page.screenshot({ path: 'qa/ten-t1e-shot.png' }) }
    if (s.st === 'circling' && i > 25) break
  }
  await page.keyboard.press('KeyQ')
  let firstReach = null
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(200)
    const s = await st()
    out.log.push(s)
    if (s.reach && firstReach === null) firstReach = i
    if (s.mounted || (firstReach !== null && i - firstReach > 2)) break
  }
  // a leap into the talons (condorTryMount's `leapt`) can take the ride before
  // E is pressed; pressing E then would be the DISMOUNT, so it is only pressed
  // on a bird that has not got the animal yet
  const preMounted = out.log.some(s => s.mounted)
  if (!preMounted) await page.keyboard.down('KeyE')
  for (let i = 0; i < 15 && !preMounted; i++) {
    await page.waitForTimeout(200)
    const s = await st()
    out.log.push(s)
    if (s.mounted) break
  }
  await page.keyboard.up('KeyE')
  const end = await st()
  out.result = { preMounted, mounted: end.mounted || out.log.some(s => s.mounted), firstReach,
    reachN: out.log.filter(s => s.reach).length, n: out.log.length,
    shotFrames: out.shot.filter(s => s.framing > 0.5).length,
    shotInFrame: out.shot.filter(s => s.framing > 0.5 && s.inShot).length, audit: end.a }
  await page.screenshot({ path: 'qa/ten-t1e-condor-end.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1e-condor-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
