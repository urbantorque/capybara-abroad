async page => {
  const TAG = 'l6-tune'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  // (1) THE TUNE IN EVERY KEY: phraseAudit over the twenty-one palettes.
  out.phrase = await page.evaluate(() => {
    const g = window.__capy, rows = [], shapes = {}
    const cur = g.musAudit().pal
    let inOk = 0
    for (let n = 0; n < 21; n++) {
      try {
        const r = g.hud.phraseAudit(n)
        rows.push({ pal: n, scale: r.scale, tonic: r.tonic, notes: r.notes, iv: r.iv.join(','), shape: r.shape, inChord: r.inChord, ok: r.ok, inst: r.inst, chord: r.chord.join(' ') })
        shapes[r.shape] = (shapes[r.shape] || 0) + 1
        if (r.inChord >= 6) inOk++
      } catch (e) { rows.push({ pal: n, err: String(e) }) }
    }
    try { g.hud.phraseAudit(cur) } catch (e) {}
    let best = 0; for (const k in shapes) if (shapes[k] > best) best = shapes[k]
    return { rows, shapes, sharedMax: best, inChordOk: inOk }
  })
  await page.waitForTimeout(1500)
  out.afterStart = await page.evaluate(() => { const m = window.__capy.musAudit(); return { pal: m.pal, scale: m.scale, tonic: m.tonic, themeSaid: m.themeSaid, themeCells: m.themeCells, liftTails: m.liftTails, chapProg: m.chapProg, layers: m.layers, ostN: m.ostN } })
  // (2) THE LIFT ENDS ON IT: one swell, and the tail counted.
  await page.evaluate(() => { window.__capy.music.swell(1) })
  await page.waitForTimeout(2500)
  out.afterSwell = await page.evaluate(() => { const m = window.__capy.musAudit(); return { liftTails: m.liftTails, err: window.__capy.state.lastError || null } })
  // (3) THE OSTINATO: every task in Sydney done, chapProg 1.0, layers[3] open, notes counted.
  out.ost = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const ids = g.hud.taskIds(1)
    for (const id of ids) { try { g.hud.completeTask(id) } catch (e) {} }
    await sleep(1500)
    const m0 = g.musAudit()
    const before = { ids: ids.length, chapProg: m0.chapProg, layers: m0.layers, ostN: m0.ostN }
    await sleep(14000)
    const m1 = g.musAudit()
    return { before, after: { chapProg: m1.chapProg, layers: m1.layers, ostN: m1.ostN, themeSaid: m1.themeSaid, themeCells: m1.themeCells, liftTails: m1.liftTails }, err: g.state.lastError || null }
  })
  // (4) THE CHOIR UNDER THE AURORA: Iceland, auroraForce(1), the fifth part sings.
  await page.evaluate(() => window.__capy.hud.cross('iceland'))
  await page.waitForTimeout(9500)
  out.iceland = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const biome = g.biome.current
    const m0 = g.musAudit()
    const arrive = { pal: m0.pal, scale: m0.scale, tonic: m0.tonic, themeSaid: m0.themeSaid, choir: m0.choir, choirTuneN: m0.choirTuneN }
    let forced = null
    try { forced = g.iceland.auroraForce(1) } catch (e) { forced = 'err:' + e }
    const rows = []
    for (let i = 0; i < 16; i++) {
      await sleep(1000)
      const m = g.musAudit()
      rows.push({ t: i + 1, aur: +(g.iceland.aurora()).toFixed(2), choir: m.choir, lead: m.choirLead, hz: m.choirLeadHz, n: m.choirTuneN, on: m.choirTuneOn })
    }
    return { biome, arrive, forced, rows, err: g.state.lastError || null }
  })
  await page.screenshot({ path: 'qa/' + TAG + '-aurora.png' })
  // (5) THE CODA: a finished file on the lawn, finaleClose(), the eight notes complete.
  const allIds = await page.evaluate(async () => { const m = await import('/src/shared.js'); return m.TASKS.map(t => t.id) })
  await page.evaluate((ids) => {
    localStorage.clear()
    const seen = []; for (let k = 1; k <= 19; k++) seen.push(k)
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ids, seen, recs: {}, told: 1, rtold: 1, ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0 }))
  }, allIds)
  await page.reload(); await page.waitForTimeout(5500)
  await page.keyboard.press('Enter'); await page.waitForTimeout(4000)
  out.coda = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const rows = []
    const t0 = performance.now()
    g.hud.finaleClose()
    const iv = setInterval(() => {
      const a = g.hud.codaAudit()
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(1), notes: a.notes, hushed: a.hushed, music: a.music })
      if (rows.length >= 24) { clearInterval(iv); const a2 = g.hud.codaAudit(); res({ rows, tune: a2.tune, tuneHit: a2.tuneHit, tuneComplete: a2.tuneComplete, notes: a2.notes, err: g.state.lastError || null }) }
    }, 500)
  }))
  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=l6-tune.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
