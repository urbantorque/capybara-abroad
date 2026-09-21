async page => {
  // ROADMAP-WOW3 D7 — THE SIX LANDINGS. Same save-forced-stow pattern W6's
  // own qa/wow2-waits-companions.js used (and N3's wow2-waits.js before it
  // for the pigeon): a fresh boot with the save already carrying a kind,
  // claim it via .capyui-carry, cross into its own `from` chapter, and read
  // stowDebug() for the kind -> null, why: 'home' transition. NEW here: a
  // placed camera aimed at compHOME[kind] (systems.js), rendered and
  // grabbed the moment `state === 'go'` is first observed — the object is
  // full-size for the first ~1.7 s of its 2.4 s walk-off (the shrink is
  // only the last third), so polling every ~250 ms and capturing on the
  // first 'go' sample lands well inside that window.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })

  // compHOME, copied from systems.js for the camera placement only (not a
  // second source of truth for the game — the game's own compHOME is what
  // is actually under test).
  const HOME = {
    pigeon:        { x: 12,    z: -17 },
    cat:           { x: 0,     z: 34 },
    'silver gull': { x: -13.5, z: 47.0 },
    gentoo:        { x: 24,    z: 92 },
    heron:         { x: 48,    z: -6 },
    ibis:          { x: -10.0, z: 12.6 },
  }
  const KINDS = [['pigeon', 'venice'], ['cat', 'goreme'], ['silver gull', 'manly'],
                 ['gentoo', 'antarctic'], ['heron', 'kyoto'], ['ibis', 'sydney']]

  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(2500)
  const oneTaskId = (await page.evaluate(() => (window.__capy.tasksInChapter(1) || [])[0])) || 'wheek-sydney'
  const out = { errs, oneTaskId, rows: {} }

  for (const [kind, biome] of KINDS) {
    await page.addInitScript((o) => {
      try {
        localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: [o.tid], seen: [1], recs: {}, ms: 0, stow: { kind: o.kind, from: o.biome } }))
      } catch (e) {}
    }, { tid: oneTaskId, kind, biome })
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(1800)
    await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })

    const home = HOME[kind]
    // ---- Sydney is the game's own DEFAULT boot chapter — ibis's `from` is
    // sydney, so it is already "home" from the very first frame and never
    // gets an explicit hud.cross to poll after. Poll right away, briefly,
    // for that in-situ case before falling back to the normal wait+cross.
    let caught = null, atBoot = null
    for (let tries = 0; tries < 14 && !caught; tries++) {
      const r = await page.evaluate((h) => {
        const g = window.__capy
        if (!g.state || !g.state.started) return { sd: null }
        const sd = g.stowDebug()
        if (sd.state !== 'go' || sd.why !== 'home') return { sd }
        const T = g.THREE
        const cam = new T.PerspectiveCamera(50, 1280 / 760, 0.3, g.camera.far)
        const gy = (g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight)
          ? g[g.biome.current].terrainHeight(h.x, h.z) : 0
        cam.position.set(h.x + 15, gy + 10, h.z + 15)
        cam.lookAt(h.x, gy + 1.0, h.z)
        cam.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam)
        const c2 = document.createElement('canvas'); c2.width = 640; c2.height = 480
        const ctx = c2.getContext('2d')
        ctx.drawImage(g.renderer.domElement, 0, 0, 640, 480)
        return { sd, shot: c2.toDataURL('image/png') }
      }, home)
      if (r.sd) atBoot = r.sd
      if (r.shot) caught = r
      else await page.waitForTimeout(200)
    }
    if (!atBoot) atBoot = await page.evaluate(() => window.__capy.stowDebug())
    if (!caught) {
      await page.waitForTimeout(1700)
      await page.evaluate((n) => window.__capy.hud.cross(n), biome)
      await page.waitForFunction((n) => window.__capy.biome.current === n, biome, { timeout: 60000, polling: 300 })
    }
    for (let tries = 0; tries < 40 && !caught; tries++) {
      const r = await page.evaluate((h) => {
        const g = window.__capy, T = g.THREE
        const sd = g.stowDebug()
        if (sd.state !== 'go' || sd.why !== 'home') return { sd }
        // ---- caught: place a camera looking at the home spot, at a
        // height/distance that reads the object without clipping into
        // whatever is built right there, render, and grab it -------------
        const cam = new T.PerspectiveCamera(50, 1280 / 760, 0.3, g.camera.far)
        const gy = (g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight)
          ? g[g.biome.current].terrainHeight(h.x, h.z) : 0
        cam.position.set(h.x + 15, gy + 10, h.z + 15)
        cam.lookAt(h.x, gy + 1.0, h.z)
        cam.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam)
        const c2 = document.createElement('canvas'); c2.width = 640; c2.height = 480
        const ctx = c2.getContext('2d')
        ctx.drawImage(g.renderer.domElement, 0, 0, 640, 480)
        const url = c2.toDataURL('image/png')
        return { sd, shot: url }
      }, home)
      if (r.shot) caught = r
      else await page.waitForTimeout(150)
    }
    if (caught) {
      await page.evaluate(async (o) => {
        await fetch('/shot?name=wow3-d7-home-' + o.kind.replace(/\s+/g, '') + '.png', { method: 'POST', body: o.shot.split(',')[1] })
      }, { kind, shot: caught.shot })
    }
    await page.waitForTimeout(2600)
    const atHome = await page.evaluate(() => window.__capy.stowDebug())
    out.rows[kind] = { biome, home, atBoot, atHomeGoSample: caught ? caught.sd : null, atHome, caught: !!caught }
  }

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-d7-homecoming', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
