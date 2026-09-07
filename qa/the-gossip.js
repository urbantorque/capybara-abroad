async page => {
  // ---------------------------------------------------------------------------
  // qa/the-gossip.js — DOES THE NEXT PLACE KNOW? (ROADMAP-FUN item 6, B15)
  //
  // Four things, and they fail differently:
  //
  //   A. TROUBLE TRAVELS. Incidents in the place you left arm a `heardBad`
  //      line naming it, and somebody says it.
  //   B. SO DOES THE OTHER ECONOMY. `pho`/`fed` arm `heardGood` instead —
  //      driven by the real `npc:photo` event rather than by writing the
  //      counter, so the whole chain is under test.
  //   C. A QUIET PLACE SAYS NOTHING. No counts, no line. This is the one that
  //      would ship broken and unnoticed: a pool that arms every time is a
  //      pool that means nothing.
  //   D. ARMED IS NOT SAID. Sơn Đoòng has seven locals and none of them
  //      within sixteen metres of the spawn — measured. The line must SURVIVE
  //      an arrival with nobody at the door and land once there is somebody,
  //      which is the entire reason it is armed rather than spoken.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = {}

  // ---- A: trouble in Sydney, heard in Kyoto -------------------------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(2, 0, 1, 0, 0) })
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(5000)
  out.A = { armed: await page.evaluate(() => window.__capy.rumourAudit()) }
  await page.waitForTimeout(11000)
  out.A.after = await page.evaluate(() => window.__capy.rumourAudit())

  // ---- B: photographed in Kyoto, heard in Cali ----------------------------
  await page.evaluate(() => {
    const g = window.__capy
    g.hud.forceNoto(0, 0, 1, 0, 0)        // nothing to be cross about anywhere
    for (let i = 0; i < 3; i++) g.events.emit('npc:photo', {})
  })
  await page.waitForTimeout(1200)
  out.B = { charm: await page.evaluate(() => window.__capy.hud.charmAudit()) }
  await page.evaluate(() => { window.__capy.hud.cross('cali') })
  await page.waitForTimeout(5000)
  out.B.armed = await page.evaluate(() => window.__capy.rumourAudit())
  await page.waitForTimeout(11000)
  out.B.after = await page.evaluate(() => window.__capy.rumourAudit())

  // ---- C: a place with nothing to say about it ----------------------------
  // ALL FOUR COUNTERS, not two. The first cut cleared the mischief side and
  // armed "you are on a wall in Cali" anyway, off fifty-seven photographs the
  // session had piled up — a probe that had not set up its own premise.
  await page.evaluate(() => { window.__capy.hud.forceNoto(0, 0, 1, 0, 0) })
  await page.evaluate(() => { window.__capy.hud.cross('rio') })
  await page.waitForTimeout(6000)
  out.C = await page.evaluate(() => window.__capy.rumourAudit())

  // ---- D: armed with nobody at the door -----------------------------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(9, 3, 19, 0, 0) })
  await page.evaluate(() => { window.__capy.hud.cross('cave') })
  await page.waitForTimeout(9000)
  out.D = { atDoor: await page.evaluate(() => {
    const g = window.__capy, p = g.capy.position
    return { audit: g.rumourAudit(), near16: g.peopleNear(p.x, p.z, 16) }
  }) }
  // ...and now stand next to somebody, which is what walking would do.
  out.D.walked = await page.evaluate(async () => {
    const g = window.__capy
    const live = g.biome.current
    const L = (g.locals || []).find(x => x && x.biome === live && x.fig)
    if (!L) return { err: 'nobody in this chapter at all' }
    g.capy.body.position.set(L.x + 3, g.capy.body.position.y, L.z + 3)
    g.capy.body.velocity.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 4500))
    return { audit: g.rumourAudit(), at: +Math.hypot(3, 3).toFixed(1) }
  })

  // ---- E: how fast is somebody photographed, standing still? -------------
  // sysHEARD_GOOD is 3 and `pho` is the cheap counter of the four: B14's
  // masher reached 5 in six minutes, and this run reached 57. If three is
  // ninety seconds of standing about then the good pool arms on every
  // crossing and stops meaning anything.
  await page.evaluate(() => {
    const g = window.__capy
    g.hud.forceNoto(0, 0, 1, 0, 0)
    g.hud.cross('goreme')
  })
  await page.waitForTimeout(13000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(0, 0, 1, 0, 0) })
  out.E = { at0: await page.evaluate(() => window.__capy.hud.charmAudit().photos) }
  await page.waitForTimeout(90000)
  out.E.at90 = await page.evaluate(() => {
    const a = window.__capy.hud.charmAudit()
    return { photos: a.photos, gifts: a.gifts, by: a.byChapterPho }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-gossip.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs.slice(0, 6), errN: errs.length }, out))
}
