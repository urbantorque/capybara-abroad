// PAYOFF batch 1, job 3: STILLNESS AS A VERB.
//
// Five assertions, and the first is the one this project has got wrong twice:
//   1. THE LOAF IS ON capyRestT AND NOT ON capyStillT. Picking something up
//      must NOT cancel it. stillT is zeroed by heldProp, correctly, and both
//      the calm field and the graze shipped reading the wrong one.
//   2. It arrives at capyLOAF_T and not before.
//   3. Any input breaks it, and breaks it FAST.
//   4. The camera eases back, the score leans further, the pose changes.
//   5. Past sysCALM_INVERT a BOLD species' flee radius goes to nothing and its
//      approach rises; a species with bold 0 is untouched by any of it.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const settle = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    const park = (name) => {
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      settle(120)
    }

    // ---- 1 and 2: it arrives, and it arrives on rest ---------------------
    park('kyoto')
    let arriveT = -1
    const camAt = []
    for (let i = 0; i < 60 * 20; i++) {
      settle(1)
      if (arriveT < 0 && g.capy.loaf > 0.5) arriveT = +(i / 60).toFixed(2)
      if (i % 120 === 0) camAt.push(+g.camera.position.y.toFixed(2))
    }
    R.arriveAtS = arriveT
    R.loaf = +g.capy.loaf.toFixed(3)
    R.restT = +g.capy.restT.toFixed(1)
    R.camY = +g.camera.position.y.toFixed(2)
    R.calm = +g.state.calm.toFixed(3)
    if (arriveT < 0) R.issues.push('the loaf never arrived in 20 s of standing still')

    // ---- the DIFFERENCE the camera makes, measured against no-loaf -------
    const camWith = Math.hypot(g.camera.position.x - g.capy.position.x,
                               g.camera.position.z - g.capy.position.z)
    // ---- 3: an input breaks it, fast ------------------------------------
    g.input.x = 1
    let brokeAt = -1
    for (let i = 0; i < 60 * 4; i++) {
      settle(1)
      if (brokeAt < 0 && g.capy.loaf < 0.1) brokeAt = +(i / 60).toFixed(2)
    }
    g.input.x = 0
    R.brokeAfterS = brokeAt
    if (brokeAt < 0) R.issues.push('walking away did not break the loaf inside 4 s')
    settle(60)
    const camWithout = Math.hypot(g.camera.position.x - g.capy.position.x,
                                  g.camera.position.z - g.capy.position.z)
    R.camReachLoaf = +camWith.toFixed(2)
    R.camReachUp = +camWithout.toFixed(2)

    // ---- 1 again: A MOUTHFUL IS NOT A CANCEL ------------------------------
    park('kyoto')
    const live = g.biome.current
    const pr = g.props.find(p => !p.removed && !p.hidden && (!p.biome || p.biome === live) &&
      p.mass > 0 && p.mass < 3)
    if (pr) {
      pr.body.wakeUp()
      const c = g.capy.position
      pr.body.position.set(c.x + 0.6, c.y + 0.3, c.z)
      settle(20)
      g.input.action = true; g.input.actionPressed = true
      settle(2)
      g.input.action = false; g.input.actionPressed = false
      settle(40)
      R.held = !!g.capy.heldProp
      let loafHeld = -1
      for (let i = 0; i < 60 * 18; i++) { settle(1); if (loafHeld < 0 && g.capy.loaf > 0.5) loafHeld = +(i / 60).toFixed(2) }
      R.loafWithPropAtS = loafHeld
      R.stillTWithProp = +g.capy.stillT.toFixed(1)
      R.restTWithProp = +g.capy.restT.toFixed(1)
      if (R.held && loafHeld < 0) R.issues.push('THE LOAF READS THE WRONG TIMER: it never arrived while carrying something')
    } else R.issues.push('no grabbable prop in kyoto to test the mouthful case')

    // ---- 5: the registry inverts, per species ----------------------------
    park('kyoto')
    // walk about first, so the baseline is a moving animal
    g.input.x = 1; settle(90); g.input.x = 0; settle(10)
    const dump = () => {
      const a = g.hud.calmAudit()
      return { loaf: +a.loaf.toFixed(2), calm: +a.calm.toFixed(2),
               live: a.critters.filter(c => c.live).map(c => ({
                 b: c.biome, r: +c.r.toFixed(1), near: +c.near.toFixed(2),
                 appr: +c.appr.toFixed(2), bold: c.bold })) }
    }
    R.critBefore = dump()
    settle(60 * 20)
    R.critAfter = dump()
    R.loafAtInvert = +g.capy.loaf.toFixed(2)
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null
    return R
  })
  out.errs = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=pfloaf.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
