async page => {
  // L6 F4 — THE TRAVELLER'S NOTEBOOK.
  // Part one: nineteen departures at one row each. Each chapter is seeded
  // with ONE real row done, started in, and left through the board (travel
  // to Sydney; Sydney leaves for Pasto). Sampled 1.3 s after the decision:
  // the done card's kicker and sentence, and the notebook's entry for the
  // chapter just left. Expected: a card with a sentence 19/19 (kicker "you
  // did not stay", the chapter's `left`), an entry 19/19.
  // Part two: Venice at one row, left; back in; a second row; left again —
  // the entry rewrites (f.done 1 -> 2). Then page.reload(): the entry is
  // still there with the same text. The journal's notebook page is
  // screenshotted: qa/l6-notebook-page.png.
  // Part three: a finished file on the lawn, finaleClose(): the notebook's
  // last page is the traveller's line. qa/l6-notebook.json
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const KEY = 'capy3.journey.v1'
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(3000)
  const chapters = await page.evaluate(async () => {
    const m = await import('/src/shared.js')
    return m.CHAPTERS.map(c => ({ n: c.n, biome: c.biome, name: c.name, left: !!c.left, nb: Array.isArray(c.nb) ? c.nb.length : 0,
      rows: m.TASKS.filter(t => t.chapter === c.n && t.id.indexOf('to-') !== 0).map(t => t.id) }))
  })
  const out = { chapters: chapters.map(c => ({ n: c.n, biome: c.biome, left: c.left, nb: c.nb })), depart: [], err: null }
  // A FRESH GOTO BEFORE THE SEED: a running game writes its file on pagehide
  // (R3), so a seed followed by reload() is overwritten by the state of the
  // game that was running. Loading the title first means nothing is running.
  const seedStart = async (file) => {
    await page.goto('http://localhost:5190/')
    await page.waitForTimeout(2500)
    await page.evaluate((o) => { localStorage.clear(); localStorage.setItem(o.k, JSON.stringify(o.f)) }, { k: KEY, f: file })
    await page.reload()
    await page.waitForTimeout(5200)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(5500)
    return page.evaluate(() => { const g = window.__capy; return { started: !!g.state.started, biome: g.biome.current, err: g.state.lastError || null } })
  }
  const card = () => page.evaluate(() => {
    const g = window.__capy
    const done = document.querySelector('.capyui-done')
    const show = !!(done && done.classList.contains('show'))
    const q = s => { const el = done && done.querySelector(s); return el && !el.hidden ? (el.textContent || '').trim() : '' }
    return { show, kick: show ? q('.capyui-donekick') : '', note: show ? q('.capyui-donenote') : '', sub: show ? q('.capyui-donesub') : '', nb: g.notebook(), err: g.state.lastError || null }
  })
  // ---- part one: nineteen departures --------------------------------------
  for (const c of chapters) {
    const row = c.rows[0]
    // Sydney's board opens nothing until Sydney is enough (door: 10), so the
    // one-row departure out of Sydney is a RETURNING player's: Pasto seen.
    const st = await seedStart({ v: 1, tasks: row ? [row] : [], seen: c.n === 1 ? [1, 2] : [c.n], recs: {}, told: 1, ms: 600000, chapms: {}, finds: [], foundAt: {}, biome: c.biome, fin: 0 })
    const rec = { n: c.n, biome: c.biome, row, started: st.started, at: st.biome, err: st.err }
    if (!st.started || st.biome !== c.biome) { rec.skipped = 'not started in place'; out.depart.push(rec); continue }
    const dest = c.n === 1 ? 2 : 1
    rec.travel = await page.evaluate((d) => { const g = window.__capy; g.hud.travel(d); const a = g.hud.leaveAudit ? g.hud.leaveAudit() : null; return a ? a.busy : null }, dest)
    await page.waitForTimeout(1300)
    const k = await card()
    rec.card = { show: k.show, kick: k.kick, note: k.note.slice(0, 160), sub: k.sub }
    const e = k.nb.entries[c.n]
    rec.entry = e ? { d: e.d, t: e.t.slice(0, 200), done: e.f.done } : null
    rec.err = k.err
    if (c.n === 1) await page.screenshot({ path: 'qa/l6-notebook-card.png', timeout: 90000 })
    out.depart.push(rec)
  }
  out.cards = out.depart.filter(r => r.card && r.card.show && r.card.note).length
  out.entries = out.depart.filter(r => r.entry && r.entry.t).length
  // ---- part two: the rewrite, and the reload ------------------------------
  const ven = chapters.find(c => c.biome === 'venice')
  const two = { }
  let st = await seedStart({ v: 1, tasks: [ven.rows[0]], seen: [1, ven.n], recs: {}, told: 1, ms: 600000, chapms: {}, finds: [], foundAt: {}, biome: 'venice', fin: 0 })
  two.start = st
  await page.evaluate(() => window.__capy.hud.travel(1))
  await page.waitForTimeout(1300)
  let k = await card()
  two.first = { card: k.kick, note: k.note.slice(0, 120), entry: k.nb.entries[ven.n] ? { d: k.nb.entries[ven.n].d, done: k.nb.entries[ven.n].f.done, t: k.nb.entries[ven.n].t } : null }
  await page.waitForTimeout(9000)
  two.afterFade = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate((n) => window.__capy.hud.travel(n), ven.n)
  await page.waitForTimeout(10500)
  two.back = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate((id) => window.__capy.completeTask(id), ven.rows[1])
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__capy.hud.travel(1))
  await page.waitForTimeout(1300)
  k = await card()
  two.second = { card: k.kick, note: k.note.slice(0, 120), entry: k.nb.entries[ven.n] ? { d: k.nb.entries[ven.n].d, done: k.nb.entries[ven.n].f.done, t: k.nb.entries[ven.n].t } : null, err: k.err }
  await page.waitForTimeout(9500)
  two.saved = await page.evaluate((key) => { try { const f = JSON.parse(localStorage.getItem(key)); return f && f.nb ? f.nb : null } catch (e) { return String(e) } }, KEY)
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(5500)
  two.reload = await page.evaluate((n) => { const g = window.__capy; const nb = g.notebook(); const e = nb.entries[n]; return { biome: g.biome.current, entry: e ? { d: e.d, done: e.f.done, t: e.t } : null, count: Object.keys(nb.entries).length } }, ven.n)
  // the journal's page, with the notebook unfolded, LOOKED AT
  await page.keyboard.press('KeyJ')
  await page.waitForTimeout(900)
  two.page = await page.evaluate(() => {
    const det = document.querySelector('.capyui-jrnb')
    if (!det) return { det: false }
    det.open = true
    const ents = [...det.querySelectorAll('.capyui-nbe')].map(e => ({ d: (e.querySelector('.capyui-nbd') || {}).textContent, t: (e.querySelector('.capyui-nbt') || {}).textContent, blank: !!e.querySelector('.capyui-nbt.blank'), go: !!e.querySelector('.capyui-nbgo') }))
    return { det: true, hidden: det.hidden, sum: (det.querySelector('summary') || {}).textContent, ents }
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/l6-notebook-page.png', timeout: 90000 })
  await page.keyboard.press('KeyJ')
  out.two = two
  // ---- part three: the last page --------------------------------------------
  const allIds = [].concat(...chapters.map(c => c.rows))
  const allWithTo = await page.evaluate(async () => { const m = await import('/src/shared.js'); return m.TASKS.map(t => t.id) })
  const seen = []; for (let i = 1; i <= 19; i++) seen.push(i)
  st = await seedStart({ v: 1, tasks: allWithTo, seen, recs: {}, told: 1, ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0 })
  const fin = { start: st }
  fin.before = await page.evaluate(() => window.__capy.notebook().fin)
  await page.evaluate(() => window.__capy.hud.finaleClose())
  await page.waitForTimeout(2500)
  fin.after = await page.evaluate(() => { const g = window.__capy; return { fin: g.notebook().fin, travMet: g.travMet(), err: g.state.lastError || null } })
  await page.waitForTimeout(1500)
  fin.saved = await page.evaluate((key) => { try { const f = JSON.parse(localStorage.getItem(key)); return f && f.nb && f.nb.fin ? f.nb.fin : null } catch (e) { return String(e) } }, KEY)
  out.fin = fin
  void allIds
  await page.evaluate(o => fetch('/shot?name=l6-notebook.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
