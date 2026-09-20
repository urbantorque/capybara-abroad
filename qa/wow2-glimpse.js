async page => {
  // ROADMAP-WOW2 N2 — THE GLIMPSE. One chapter (kyoto, gateChap: 4) is
  // walked to its board and back, checked against npc:travSeen, the
  // figure's own gSt state, and a screenshot of it standing at the board —
  // read by eye. A second, un-approached chapter (rio) proves the zero.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(4500)

  // Kyoto has to have been finished once for its gateChap cameo to show —
  // force it via the same real completeTask path qa/wow2-shelf.js uses.
  await page.evaluate(() => {
    const g = window.__capy
    for (const id of (g.tasksInChapter(4) || [])) g.completeTask(id, true)
  })
  await page.evaluate((n) => window.__capy.hud.cross(n), 'kyoto')
  await page.waitForTimeout(9500)

  out.travSeenBefore = await page.evaluate(() => window.__capy.travSeenSave())

  // Teleport the animal to just outside the 25 m ring around the live
  // board, then step it inside — deterministic time, no real key holds.
  out.approach = await page.evaluate(async () => {
    const g = window.__capy
    const board = g.exitBoard()
    if (!board) return { board: null }
    // 30 m out, dead toward the board, then walk the last stretch in ticks
    const capy = g.capy
    const dx = board.x - capy.position.x, dz = board.z - capy.position.z
    const d = Math.hypot(dx, dz) || 1
    capy.position.x = board.x - (dx / d) * 30
    capy.position.z = board.z - (dz / d) * 30
    if (capy.body) { capy.body.position.x = capy.position.x; capy.body.position.z = capy.position.z }
    const steps = []
    for (let i = 0; i < 400; i++) {
      const sdx = board.x - capy.position.x, sdz = board.z - capy.position.z
      const sd = Math.hypot(sdx, sdz) || 1
      const step = Math.min(sd, 2.0 / 60)
      capy.position.x += (sdx / sd) * step
      capy.position.z += (sdz / sd) * step
      if (capy.body) { capy.body.position.x = capy.position.x; capy.body.position.z = capy.position.z }
      g.tick(1 / 60, false)
      if (i % 40 === 0) {
        let gr = null
        for (const l of g.locals) if (l.trav && l.gateChap && l.biome === 'kyoto') gr = l
        steps.push({ i, capyD: sd, gSt: gr ? gr.gSt : null })
      }
    }
    let gr = null
    for (const l of g.locals) if (l.trav && l.gateChap && l.biome === 'kyoto') gr = l
    return {
      board: { x: board.x, z: board.z },
      finalD: Math.hypot(board.x - capy.position.x, board.z - capy.position.z),
      steps,
      finalGSt: gr ? gr.gSt : null,
      figPos: gr && gr.group ? { x: gr.group.position.x, y: gr.group.position.y, z: gr.group.position.z } : null,
      figVisible: gr && gr.group ? gr.group.visible : null,
    }
  })

  out.travSeenAfter = await page.evaluate(() => window.__capy.travSeenSave())
  await page.evaluate(() => { const g = window.__capy; g.tick(1 / 60, true) })
  await page.screenshot({ path: 'qa/wow2-glimpse-kyoto-stand.png' })

  // ---- the un-approached chapter: zero -------------------------------
  out.rioNever = await page.evaluate(() => {
    const g = window.__capy
    return { travSeen: g.travSeenSave(), hasRio: !!g.travSeenSave().rio }
  })

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-glimpse', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
