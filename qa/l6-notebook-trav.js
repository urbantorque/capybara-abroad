async page => {
  // L6 F4 — THE ONE WHO KEEPS TURNING UP, FOUND. Four seeded drives, one per
  // cameo chapter (quay, sahara, goreme, hanoi): a file with Sydney left at
  // one row (so the notebook exists), started in the chapter. The naive
  // player: the paper's row "somebody keeps turning up" is on the card in
  // act one; F is pressed until the arrow is on it; the arrow is followed
  // (the same walk loop as qa/l6r-design-follow.js) for up to 180 s.
  // Expected: game.travMet(biome) = 1 in 4/4, the row off the paper after,
  // the notebook's page for the chapter with no pointer left on it.
  // qa/l6-notebook-trav.json, qa/l6-notebook-trav-<biome>.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const KEY = 'capy3.journey.v1'
  const out = { runs: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const held = new Set()
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  for (const biome of ['quay', 'sahara', 'goreme', 'hanoi']) {
    const run = { biome, f: 0, legs: [] }
    out.runs.push(run)
    await page.goto('http://localhost:5190/')
    await page.waitForTimeout(2500)
    await page.evaluate((o) => { localStorage.clear(); localStorage.setItem(o.k, JSON.stringify(o.f)) }, { k: KEY, f: { v: 1, tasks: ['wheek'], seen: [1], recs: {}, told: 1, ms: 600000, chapms: {}, finds: [], foundAt: {}, biome, fin: 0, nb: { 1: { d: '2026-09-13', f: { done: 1, total: 19 } } } } })
    await page.reload()
    await page.waitForTimeout(5200)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(6500)
    run.start = await page.evaluate(() => { const g = window.__capy; const nb = g.notebook(); return { started: !!g.state.started, biome: g.biome.current, row: nb.row, arm: nb.arm, entries: Object.keys(nb.entries).length, met: g.travMet(g.biome.current), where: g.travWhere(), err: g.state.lastError || null } })
    if (!run.start.started || run.start.biome !== biome) { run.skipped = 'not started in place'; continue }
    // the paper's row, and F until the arrow is on it (a naive player reads
    // the card and presses the one key it names)
    run.rowVisible = await page.evaluate(() => { const li = document.querySelector('.capyui-trav'); return !!li && !li.classList.contains('capyui-hidden') })
    for (let i = 0; i < 20; i++) {
      const top = await page.evaluate(() => { const li = document.querySelector('.capyui-trav'); return !!(li && li.querySelector('.capyui-aim.on')) })
      if (top) break
      await tap('KeyF', 90); run.f++
      await page.waitForTimeout(350)
    }
    run.pinned = await page.evaluate(() => { const li = document.querySelector('.capyui-trav'); const clue = document.querySelector('.capyui-clue'); return { aim: !!(li && li.querySelector('.capyui-aim.on')), clue: clue ? clue.textContent : '' } })
    await page.screenshot({ path: 'qa/l6-notebook-trav-' + biome + '-paper.png', timeout: 90000 })
    const t0 = Date.now()
    const now = () => (Date.now() - t0) / 1000
    let stuckT = 0, lastD = 1e9, met = 0, metAt = -1, minD = 1e9
    while (now() < 180) {
      const s = await page.evaluate(() => {
        const g = window.__capy
        const p = g.capy.position
        const h = g.hintTarget('traveller')
        return { x: p.x, z: p.z, camYaw: g.input.camYaw, target: h ? { x: h.x, z: h.z } : null, met: g.travMet(g.biome.current), err: g.state.lastError || null, chase: !!g.capy.carriedBy }
      })
      if (s.err) { run.err = s.err; break }
      if (s.met) { met = 1; metAt = +now().toFixed(1); break }
      if (!s.target) { run.legs.push(['no-target', +now().toFixed(1)]); await page.waitForTimeout(1000); if (now() > 20) break; continue }
      const dx = s.target.x - s.x, dz = s.target.z - s.z
      const d = Math.hypot(dx, dz)
      if (d < minD) minD = d
      const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw)
      const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
      const want = new Set()
      if (d > 1.6) {
        if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS')
        if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD')
        if (d > 12) want.add('ShiftLeft')
      }
      await setKeys(want)
      if (lastD - d < 0.15) stuckT += 0.35; else stuckT = 0
      lastD = d
      if (stuckT > 2.0) { await tap('Space', 90); stuckT = 0.8 }
      await page.waitForTimeout(200)
    }
    await setKeys(new Set())
    run.met = met; run.metAt = metAt; run.minD = +minD.toFixed(1); run.t = +now().toFixed(1)
    await page.waitForTimeout(800)
    run.after = await page.evaluate(() => { const g = window.__capy; const nb = g.notebook(); const li = document.querySelector('.capyui-trav'); return { row: nb.row, rowVisible: !!li && !li.classList.contains('capyui-hidden'), travMet: g.travMet(), err: g.state.lastError || null } })
    await page.screenshot({ path: 'qa/l6-notebook-trav-' + biome + '.png', timeout: 90000 })
    // written after every run: a page that crashes on the fourth chapter
    // (it did) must not take the first three with it
    out.met = out.runs.filter(r => r.met).length
    await page.evaluate(o => fetch('/shot?name=l6-notebook-trav.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  }
  out.met = out.runs.filter(r => r.met).length
  await page.evaluate(o => fetch('/shot?name=l6-notebook-trav.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
