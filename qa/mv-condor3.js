async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(6000)

  // ---- LEG 1: a first-timer. Two whistles, as the chapter teaches. --------
  const first = await page.evaluate(() => {
    const g = window.__capy
    const inp = g.input
    const D = 1 / 60
    const b = g.capy.body
    let sact = false, sactEdge = false
    function T (k) {
      for (let i = 0; i < k; i++) {
        inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0
        inp.action = sact; inp.actionPressed = sactEdge; sactEdge = false
        inp.jump = false; inp.jumpPressed = false
        g.tick(D, false)
      }
    }
    window.__T = T
    window.__setAct = (a, e) => { sact = a; sactEdge = e }
    g.condor.summon()
    let t = -1
    for (let s = 0; s < 45; s++) {
      T(60)
      if (s === 5) g.condor.summon()          // the taught second whistle
      if (g.condor.talonInReach()) { t = s + 1; break }
    }
    if (t < 0) return { tReach: -1, rode: false }
    sact = true; sactEdge = true; T(4); sact = false; T(30)
    const rode = !!g.condor.mounted
    return { tReach: t, rode: rode, taskDone: !!(g.taskDone && g.taskDone('condor-ride')) }
  })

  // ---- LEG 2: dismount, and call it again with ONE whistle ----------------
  const second = await page.evaluate(() => {
    const g = window.__capy
    const T = window.__T
    // let go and land
    window.__setAct(true, true); T(6); window.__setAct(false, false)
    T(60 * 12)
    if (g.condor.state !== 'gone' && g.condor.release) { g.condor.release(); T(60) }
    // put the animal back on the ground and wait for the bird to clear out
    const sp = g.biome.spawnOf('pasto'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60 * 25 && g.condor.state !== 'gone'; i++) T(1)
    const cleared = g.condor.state
    // ONE whistle, and nothing else
    const ok = g.condor.summon()
    let t = -1
    for (let s = 0; s < 45; s++) {
      T(60)
      if (g.condor.talonInReach()) { t = s + 1; break }
    }
    return { cleared: cleared, summoned: ok, tReach: t, state: g.condor.state,
             taskDone: !!(g.taskDone && g.taskDone('condor-ride')) }
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-condor3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { first: first, second: second })
}
