async page => {
  // L4 E5 — THE VOICE IN SYDNEY AND PASTO. Two phases, one JSON.
  //
  // A. THE SOAK. Sydney (fresh file, Begin), Pasto (Digit2) and Iceland
  //    (Digit7): 120 s each of walking the animal in a slow circle near the
  //    spawn — W taps with A turns — so the people there notice it, while a
  //    MutationObserver on the four `.capynpc-bubble` slots records every
  //    line the moment its text is written. Reported per chapter: total and
  //    distinct bubbles, the ratio (target >= 0.85), the top three repeated
  //    lines, and palAudit()/rumourAudit() at the end.
  // B. THE SEEDED SAVE. A journey file with the regulars at tier 3 in
  //    chapters 1 and 2, `carry on` from the title, the animal put down two
  //    metres from the waiter; then hud.cross('pasto') — a real crossing with
  //    from: 'sydney' — and the same beside the woman with the broom. Reported:
  //    palAudit() before and after (line armed, who, free, dist, said, last),
  //    rumourAudit() in Pasto (why: 'first', said, last), and the bubbles
  //    heard, so the tier-3 `call` line and 'Word came up from Sydney.' are
  //    read off the DOM and not off the writer.
  //   qa/l4-lines-soak.json — { soak: [{ chapter, total, distinct, ratio,
  //   top, pal, rumour, err }], seeded: { sydney: {...}, pasto: {...} } }
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  // Fresh on every navigation unless the seeded phase has asked to keep it.
  await page.addInitScript(() => { try { if (!localStorage.getItem('capy3.qa.keep')) localStorage.clear() } catch (e) {} })
  const out = { soak: [], seeded: {} }
  const watch = () => page.evaluate(() => {
    const g = window.__capy
    const L = window.__l4ls = { t0: g.state.time, lines: [] }
    const seen = new WeakMap()
    const mo = new MutationObserver(ms => {
      for (const m of ms) {
        let n = m.target.nodeType === 3 ? m.target.parentNode : m.target
        while (n && n !== document.body && !(n.classList && n.classList.contains('capynpc-bubble'))) n = n.parentNode
        if (!n || n === document.body) continue
        const span = n.querySelector('span')
        const text = span ? span.textContent : ''
        if (!text) continue
        // one record per WRITE: the same slot rewritten with the same text is
        // a second line, and a style flip on the slot is not one
        if (m.type === 'attributes') continue
        const k = seen.get(n) || { t: -1, text: '' }
        const now = +(g.state.time - L.t0).toFixed(2)
        if (k.text === text && now - k.t < 0.5) continue
        seen.set(n, { t: now, text })
        L.lines.push({ t: now, text })
      }
    })
    mo.observe(document.body, { childList: true, characterData: true, subtree: true })
  })
  const tally = () => page.evaluate(() => {
    const g = window.__capy, L = window.__l4ls
    const count = {}
    for (const l of L.lines) count[l.text] = (count[l.text] || 0) + 1
    const top = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 3).map(t => ({ n: count[t], text: t.slice(0, 60) }))
    const total = L.lines.length, distinct = Object.keys(count).length
    return { chapter: g.biome.current, elapsed: +(g.state.time - L.t0).toFixed(0),
             total, distinct, ratio: total ? +(distinct / total).toFixed(3) : null, top,
             first: L.lines.slice(0, 12).map(l => l.t + ' ' + l.text.slice(0, 50)),
             pal: typeof g.palAudit === 'function' ? g.palAudit() : null,
             rumour: typeof g.rumourAudit === 'function' ? g.rumourAudit() : null,
             err: g.state.lastError || null }
  })
  // ---- A. the soak ------------------------------------------------------
  const CH = [['sydney', null], ['pasto', 'Digit2'], ['iceland', 'Digit7']]
  for (const [name, key] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    if (key) { await page.keyboard.press(key); await page.waitForTimeout(9000) }
    else { await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(1500) }
    const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    await watch()
    // 120 s in 3 s legs: a walk, a turn, a pause — a slow circle of roughly
    // eight metres around wherever the chapter put the animal down
    for (let leg = 0; leg < 40; leg++) {
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(1300)
      await page.keyboard.down('KeyA')
      await page.waitForTimeout(380)
      await page.keyboard.up('KeyA')
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(1320)
    }
    const row = await tally()
    row.started = started
    out.soak.push(row)
  }
  // ---- B. the seeded save ----------------------------------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    localStorage.clear()
    // tasks must not be empty, or the title offers `begin` and the restore
    // branch is never taken — see qa/b6-recs.js
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: ['wheek'], seen: [1], recs: {}, told: 1, ms: 60000,
      chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0,
      pal: { 1: 3, 2: 3 },
    }))
    localStorage.setItem('capy3.qa.keep', '1')
  })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  await watch()
  const seed = async (biome) => {
    const before = await page.evaluate(() => window.__capy.palAudit())
    // put the animal down two metres from the regular, facing them
    await page.evaluate((b) => {
      const g = window.__capy, a = g.palAudit()
      const f = a.found.find(r => r.b === b)
      if (!f) return
      g.capy.body.position.set(f.x + 1.6, f.y + 0.6, f.z + 1.4)
      g.capy.body.velocity.set(0, 0, 0)
    }, biome)
    await page.waitForTimeout(14000)
    const after = await page.evaluate(() => window.__capy.palAudit())
    const rumour = await page.evaluate(() => (typeof window.__capy.rumourAudit === 'function') ? window.__capy.rumourAudit() : null)
    const heard = await page.evaluate(() => window.__l4ls.lines.map(l => l.t + ' ' + l.text.slice(0, 60)))
    const row = { started: await page.evaluate(() => !!window.__capy.state.started),
                  before: { line: before.line, tier: before.tier, who: before.who, dist: before.dist, free: before.free, keep: before.keep, found: before.found.filter(r => r.b === biome) },
                  after: { line: after.line, tier: after.tier, who: after.who, dist: after.dist, free: after.free, said: after.said, last: after.last, fam: after.fam, missing: after.missing },
                  rumour, heard,
                  err: await page.evaluate(() => window.__capy.state.lastError || null) }
    return row
  }
  out.seeded.sydney = await seed('sydney')
  await page.evaluate(() => { window.__l4ls.lines.length = 0; window.__capy.hud.cross('pasto') })
  await page.waitForTimeout(12000)
  out.seeded.pasto = await seed('pasto')
  await page.evaluate(() => { try { localStorage.removeItem('capy3.qa.keep') } catch (e) {} })
  await page.evaluate((o) => fetch('/shot?name=l4-lines-soak.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
