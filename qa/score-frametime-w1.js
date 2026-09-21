async page => {
  // ROADMAP-SCORE W1 — the scheduler's cost. musTickBody is timed inside
  // musTick (musThemeAudit().tickMs) so this reads the tick's own bill, not
  // the frame's: every layer live (a chapter done — countermelody, pulse,
  // walking bass, ostinato — with a full statement running) against
  // noTheme + noArc + noMotif, twenty seconds an arm, two arms each, in
  // Sydney and Kyoto. The target is ≤ 0.2 ms a tick with everything live.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(4000)
  const out = { errs, rows: {} }
  const arm = (live) => page.evaluate(async (live) => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.state.noTheme = !live; g.state.noArc = !live; g.state.noMotif = !live
    if (live) g.hud.statement('full', 'rest', 0)
    await sleep(1500)
    g.hud.tickMsReset()
    await sleep(20000)
    const a = g.musThemeAudit()
    return { live, mean: a.tickMs.mean, max: a.tickMs.max, n: a.tickMs.n, stmt: a.live ? a.live.kind : null, layers: a.layers, ac: a.ac, prog: a.prog, err: g.state.lastError || null }
  }, live)
  for (const name of ['sydney', 'kyoto']) {
    if (name !== 'sydney') { await page.evaluate((n) => window.__capy.hud.cross(n), name); await page.waitForTimeout(9500) }
    // every task of the chapter: the layers all open
    await page.evaluate(() => { const g = window.__capy; const n = g.biome.current === 'kyoto' ? 4 : 1; for (const id of g.hud.taskIds(n)) { try { g.hud.completeTask(id) } catch (e) {} } })
    await page.waitForTimeout(3000)
    const rows = []
    for (let rep = 0; rep < 2; rep++) { rows.push(await arm(true)); rows.push(await arm(false)) }
    const live = rows.filter(r => r.live), cut = rows.filter(r => !r.live)
    const mean = a => a.reduce((s, r) => s + r.mean, 0) / a.length
    out.rows[name] = { rows, liveMean: +mean(live).toFixed(3), cutMean: +mean(cut).toFixed(3), liveMax: Math.max(...live.map(r => r.max)), cutMax: Math.max(...cut.map(r => r.max)) }
  }
  await page.evaluate(() => { const g = window.__capy; g.state.noTheme = false; g.state.noArc = false; g.state.noMotif = false })
  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=score-frametime-w1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
