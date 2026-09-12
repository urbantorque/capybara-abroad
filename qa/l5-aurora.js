async page => {
  // L5 M3 — THE AURORA, THE CONDUCTOR: the sky forced up, the animal at the
  // spring; four calls 1.8 s apart are a run of four and the burst (opacity
  // to full, sparks, slow-mo, a shot); a fifth call after 5 s breaks the run
  // and files it; the sky aged past its stay fades, and a call brings it
  // back. qa/l5-aurora.json; qa/l5-aurora-burst.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('iceland') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const audit = () => page.evaluate(() => { const g = window.__capy, a = g.iceland.auroraAudit(); a.ts = +(g.state.timeScale || 1).toFixed(2); a.sparks = g.sparksLive(); a.shot = +g.camInfo.shot.toFixed(2); a.live = g.hud.recordAudit().val; return a })
  await page.evaluate(() => { const g = window.__capy, sp = g.iceland.spring, b = g.capy.body; b.position.set(sp.x + 2, 0.4, sp.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.iceland.auroraForce(1) })
  await page.waitForTimeout(1500)
  out.up = await audit()
  out.calls = []
  for (let k = 0; k < 4; k++) {
    await page.evaluate(() => window.__capy.iceland.auroraCall())
    await page.waitForTimeout(250)
    out.calls.push(await audit())
    if (k === 3) await page.screenshot({ path: 'qa/l5-aurora-burst.png', timeout: 90000 })
    await page.waitForTimeout(1550)
  }
  await page.waitForTimeout(4500)
  out.broken = await audit()
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['aurora'])
  // the fade and the recall
  await page.evaluate(() => window.__capy.iceland.auroraAge(239))
  await page.waitForTimeout(3500)
  out.fading = await audit()
  await page.evaluate(() => window.__capy.iceland.auroraCall())
  await page.waitForTimeout(2500)
  out.recalled = await audit()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-aurora.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
