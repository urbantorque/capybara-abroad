async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}

  // ---- 1. footfalls: material already matches the puff/track (capySfxOpts.mat
  // = capySurfMat, the same call's other answer) — confirmed here on Venice's
  // stone; capybara.js/systems.js untouched, found already built. ------------
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(2500)
  await page.locator('.capyui-go').first().click()
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForFunction(() => window.__capy.biome.current === 'venice', { timeout: 60000, polling: 300 })
  await page.waitForTimeout(4000)

  // ---- 2. the drip: sfxDrip already exists and is already wired to
  // weather.js's own b.drip bed level — genuinely a discrete, jittered,
  // audible cue keyed to the same wetness signal the eave's mote uses. Force
  // the shower hard (trap 35's own pattern) and count it. -------------------
  const dripBefore = await page.evaluate(() => window.__capy.sfxAudit()['drip'] || 0)
  await page.evaluate(() => window.__capy.weather.set('venice', { rain: { odds: 1, peak: 0.9, hold: 40, gap: 1 } }))
  await page.waitForTimeout(9000)
  out.drip = await page.evaluate((before) => {
    const g = window.__capy
    return { dripN: (g.sfxAudit()['drip'] || 0) - before, bedDrip: g.weather.bed().drip }
  }, dripBefore)

  const stepBefore = await page.evaluate(() => window.__capy.sfxAudit())
  out.footfallMaterials = { before: stepBefore }
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    b.position.set(-2, 1.4, 16); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.keyboard.down('w')
  await page.waitForTimeout(1600)
  await page.keyboard.up('w')
  out.footfallMaterials.after = await page.evaluate(() => window.__capy.sfxAudit())

  // ---- 3. the shelf: sysShelfStage now sounds one 'chime' the moment a NEW
  // keepsake is laid — the real gap this pass fixed (a synchronous restore
  // outran the AudioContext resume, and the same tick's own ambience burst
  // saturated the D9 voice ceiling; `setTimeout(..., 80)` + `force: true`). --
  const tid = await page.evaluate(() => (window.__capy.tasksInChapter(3) || [])[0] || 'wheek-quay')
  const ids = await page.evaluate(() => (window.__capy.tasksInChapter(3) || []))
  await page.addInitScript((o) => {
    try { localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: o.ids, seen: [3], recs: {}, ms: 0, biome: 'sydney' })) } catch (e) {}
  }, { ids, tid })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(1800)
  const chimeBefore = await page.evaluate(() => window.__capy.sfxAudit().chime || 0)
  await page.locator('.capyui-carry, .capyui-go').first().click()
  await page.waitForTimeout(3000)
  out.shelfChime = await page.evaluate((before) => {
    const g = window.__capy
    return { chimeN: (g.sfxAudit().chime || 0) - before, shelfHeld: g.shelfAudit().shelf }
  }, chimeBefore)

  // ---- 4. the traveller's walk-off: N2's fifteen glimpse figures move by a
  // raw position increment (npcGlimpseStep's 'leave' state), not the shared
  // gait, and were genuinely silent — checked first, confirmed here. --------
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(2500)
  await page.locator('.capyui-go').first().click()
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForFunction(() => window.__capy.biome.current === 'venice', { timeout: 60000, polling: 300 })
  await page.waitForTimeout(4000)
  const stepBefore2 = await page.evaluate(() => window.__capy.sfxAudit()['step'] || 0)
  const found = await page.evaluate((before) => {
    const g = window.__capy
    let rec = null
    for (const l of (g.locals || [])) if (l && l.trav && l.gateChap && l.biome === 'venice') { rec = l; break }
    if (!rec) return { err: 'no glimpse record' }
    rec.gSt = 'leave'; rec.gT = 0; rec.gStepT = 0; rec.gGoX = 0; rec.gGoZ = -1
    if (rec.group) rec.group.visible = true
    return { found: true, kind: rec.kind }
  }, stepBefore2)
  await page.waitForTimeout(3200)
  out.glimpseWalkOff = await page.evaluate((before) => {
    const g = window.__capy
    return { stepN: (g.sfxAudit()['step'] || 0) - before }
  }, stepBefore2)
  out.glimpseWalkOff.found = found

  // ---- 5. the companion's approach: compClimb (the re-mount) unconditionally
  // plays `compTr.voice` — the exact channel X1c's "comes over" beat already
  // ends on, by reusing compTake -> 'follow' and letting the ordinary follow
  // logic close the distance to a climb. Not re-verified end to end here
  // (W3's own qa/wow3-x1c-comes-over.js already proved the beat live for two
  // kinds); this instrument records the static fact that makes it so:
  // compTRAITS[kind].voice is set for all six kinds, unconditionally read.
  out.companionApproach = await page.evaluate(() => {
    // no closure access from outside; the static claim is checked by grep in
    // the write-up. Left here as a placeholder so wow3-heard.js's shape
    // matches the roadmap's five items.
    return { note: 'see W3 qa/wow3-x1c-comes-over.js for the live re-mount proof; compClimb\'s sfx(compTr.voice) call is unconditional and unchanged' }
  })

  await page.evaluate(async (obj) => {
    const b64 = btoa(JSON.stringify(obj))
    await fetch('/shot?name=wow3-heard', { method: 'POST', body: b64 })
  }, { out, errs })
}
