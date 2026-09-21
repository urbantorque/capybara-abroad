async page => {
  // ROADMAP-SCORE W1 — the theme, counted. Everything read here is what the
  // SCHEDULER decided (game.musThemeAudit counts scheduled notes), so it
  // holds whether the harness's AudioContext is running or suspended; `ac`
  // in every row says which. Five modes, one per run-code (each under four
  // minutes), picked by the first line of qa/score-mode.txt — run-code
  // passes no arguments and no environment, and the dev server serves qa/,
  // so the page fetches the marker: 'sweep' (Sydney + nine chapters),
  // 'sweep-b' (the other nine), 'sydney', 'coda', 'motifs'. No marker: sweep.
  //   sweep  — Begin into Sydney, then hud.cross each chapter of its half:
  //            a full statement within 40 s of every arrival, its key and
  //            notes; plus hud.themeAudit over all 21 palettes (degrees in
  //            scale) on the first half.
  //   sydney — one chapter from 0 to done through hud.completeTask, in
  //            thirds: the countermelody at 1/3, the pulse at 1/2, the
  //            walking bass at 2/3, the full statement at done, then the
  //            ostinato.
  //   coda   — a finished file, finaleClose(): the coda's twenty pitches are
  //            A + B + tag in Sydney's key.
  //   motifs — each motif fired once by its own event.
  await page.goto('http://localhost:5188/qa/score-mode.txt').catch(() => null)
  let MODE = 'sweep'
  try { MODE = ((await page.evaluate(() => document.body.innerText)) || '').trim().split(/\s+/)[0] || 'sweep' } catch (e) {}
  if (['sweep', 'sweep-b', 'sydney', 'coda', 'motifs'].indexOf(MODE) < 0) MODE = 'sweep'
  const ALL = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const CHAPS = MODE === 'sweep-b' ? ALL.slice(9) : ALL.slice(0, 9)
  const TAG = 'score-theme-' + MODE
  const errs = []
  // (listeners after the marker page: its 404s are not the game's)
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { mode: MODE, errs }
  const post = async () => { out.errs = errs; await page.evaluate(([o, name]) => fetch('/shot?name=' + name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), [out, TAG]) }
  // wait for the next FULL (or the named kind) statement to start, up to `limit` s
  const waitStmt = (kind, limit) => page.evaluate(([kind, limit]) => new Promise(res => {
    const g = window.__capy
    const n0 = g.musThemeAudit().stmts[kind]
    const t0 = performance.now()
    const iv = setInterval(() => {
      const a = g.musThemeAudit()
      const dt = (performance.now() - t0) / 1000
      if (a.stmts[kind] > n0 || dt > limit) {
        clearInterval(iv)
        res({ ok: a.stmts[kind] > n0, after: +dt.toFixed(1), ac: a.ac, last: a.last, live: a.live, pending: a.pending, biome: g.biome.current, pal: a.pal, ocaN: a.ocaN, cmN: a.cmN, err: g.state.lastError || null })
      }
    }, 250)
  }), [kind, limit])

  if (MODE === 'sweep' || MODE === 'sweep-b') {
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    out.started = await page.evaluate(() => window.__capy.state.started)
    if (MODE === 'sweep') {
      out.palettes = await page.evaluate(() => {
        const g = window.__capy, rows = []
        let scaleOk = 0
        for (let n = 0; n < 21; n++) {
          const r = g.hud.themeAudit(n)
          if (r.inScale === r.n) scaleOk++
          rows.push({ pal: n, scale: r.scale, tonic: r.tonic, mode: r.mode, n: r.n, inScale: r.inScale, inChord: r.inChord, chordShare: r.chordShare })
        }
        return { scaleOk, rows }
      })
    }
    out.arrivals = []
    // Sydney is the Begin arrival: the phrase, then the statement 6 s after
    out.arrivals.push(Object.assign({ chapter: 'sydney' }, await waitStmt('full', 40)))
    for (const name of CHAPS) {
      await page.evaluate((n) => window.__capy.hud.cross(n), name)
      const r = await waitStmt('full', 45)
      r.chapter = name
      out.arrivals.push(r)
      await page.waitForTimeout(2500)
    }
    out.ok = out.arrivals.filter(r => r.ok && r.biome === r.chapter).length + '/' + out.arrivals.length
    await post(); return
  }

  if (MODE === 'sydney') {
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    out.arrive = await waitStmt('full', 40)
    await page.waitForTimeout(24000)   // let it finish
    out.steps = await page.evaluate(async () => {
      const g = window.__capy
      const sleep = ms => new Promise(r => setTimeout(r, ms))
      const ids = g.hud.taskIds(1)
      const rows = []
      let done = 0
      for (const frac of [0.34, 0.5, 0.67]) {
        const want = Math.ceil(ids.length * frac)
        while (done < want) { try { g.hud.completeTask(ids[done]) } catch (e) {} done++ }
        await sleep(1500)
        const a0 = g.musThemeAudit()
        await sleep(20000)
        const a1 = g.musThemeAudit()
        rows.push({ frac, prog: a1.prog, layers: a1.layers, counterN: a1.counterN - a0.counterN, walkN: a1.walkN - a0.walkN,
                    pulseN: a1.pulseN - a0.pulseN, secondN: g.musAudit().secondN, ostN: a1.ostN, err: g.state.lastError || null })
      }
      return { ids: ids.length, rows }
    })
    // done: the rest of the rows, the ceremony, the full statement, then the ostinato
    await page.evaluate(() => { const g = window.__capy; for (const id of g.hud.taskIds(1)) { try { g.hud.completeTask(id) } catch (e) {} } })
    out.done = await waitStmt('full', 15)
    out.doneOst0 = await page.evaluate(() => { const a = window.__capy.musThemeAudit(); return { ostN: a.ostN, layers: a.layers, live: a.live ? a.live.kind : null } })
    await page.waitForTimeout(26000)
    out.doneOst1 = await page.evaluate(() => { const a = window.__capy.musThemeAudit(); return { ostN: a.ostN, layers: a.layers, live: a.live ? a.live.kind : null, moments: a.moments, stmts: a.stmts, ac: a.ac } })
    await post(); return
  }

  if (MODE === 'coda') {
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(4000)
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
        if (rows.length >= 24) {
          clearInterval(iv)
          const a2 = g.hud.codaAudit(), ta = g.musThemeAudit()
          res({ rows, tune: a2.tune, pitches: a2.pitches, whole: a2.whole, notes: a2.notes, pal: ta.pal, tonic: ta.tonic, scale: ta.scale, ac: ta.ac, err: g.state.lastError || null })
        }
      }, 500)
    }))
    await page.screenshot({ path: 'qa/' + TAG + '.png' })
    await post(); return
  }

  if (MODE === 'motifs') {
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    out.arrive = await waitStmt('full', 40)
    await page.waitForTimeout(24000)   // motifs are dropped under a statement; let it finish
    out.ev = await page.evaluate(async () => {
      const g = window.__capy
      const sleep = ms => new Promise(r => setTimeout(r, ms))
      const rows = []
      const snap = (label) => { const a = g.musThemeAudit(); rows.push({ label, motifs: a.motifs, ev: a.motifEv, dropped: a.motifDropped, ac: a.ac, err: g.state.lastError || null }) }
      snap('before')
      g.events.emit('npc:travSeen', { biome: 'sydney', n: 1 }); await sleep(600); snap('npc:travSeen')
      await sleep(4500)
      g.events.emit('npc:travMet', { biome: 'sydney', n: 1 }); await sleep(700); snap('npc:travMet')
      await sleep(4500)
      g.events.emit('shelf:grew', { ks: 1 }); await sleep(500); snap('shelf:grew')
      await sleep(4500)
      const c = g.hud.motif('companion'); await sleep(300); snap('companion (hud door) ' + c)
      return rows
    })
    await post(); return
  }
}
