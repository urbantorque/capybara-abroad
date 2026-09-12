async page => {
  // L4 E3 — THE FIRST MINUTE. A naive three-minute drive on a FRESH file in
  // Sydney, Kyoto and Hanoi: W held with a turn every few seconds, a hop
  // every six, E every nine, a run now and then — a player who has read
  // nothing. Counted off the DOM, not off the writer: every .capyui-toast
  // that appears (its kind and its text, with the second it landed), every
  // moment card (its kicker), the first incident's time, and findCount at
  // the end. The review measured 20–25 toasts in minute one and an incident
  // card at 23 s; the roadmap asks for <= 6 in minute one, no find at three
  // minutes, and the first incident after 60 s in Sydney.
  //   qa/l4-first-minute.json — { rows: [{ chapter, perMin: [..], say, note,
  //   first: [...minute-one texts], firstIncident, finds, started }] }
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const CH = [['sydney', null], ['kyoto', 'Digit4'], ['hanoi', 'Slash']]
  const out = { rows: [] }
  for (const [name, key] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    if (key) { await page.keyboard.press(key); await page.waitForTimeout(9000) }
    else { await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(1500) }
    const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    await page.evaluate(() => {
      const g = window.__capy
      const L = window.__l4fm = { t0: g.state.time, toasts: [], moments: [], incident: -1 }
      const wrap = document.querySelector('.capyui-toast') ? document.querySelector('.capyui-toast').parentNode : null
      const mo = new MutationObserver(ms => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('capyui-toast'))
            L.toasts.push({ t: +(g.state.time - L.t0).toFixed(1), kind: n.classList.contains('note') ? 'note' : n.classList.contains('last') ? 'last' : 'say', text: n.textContent.slice(0, 70) })
        }
      })
      mo.observe(document.body, { childList: true, subtree: true })
      const mom = document.querySelector('.capyui-moment')
      if (mom) {
        const mo2 = new MutationObserver(() => {
          if (mom.classList.contains('show')) {
            const k = (mom.querySelector('.capyui-momentkick') || mom.firstElementChild || {}).textContent || ''
            L.moments.push({ t: +(g.state.time - L.t0).toFixed(1), kick: k.slice(0, 30) })
          }
        })
        mo2.observe(mom, { attributes: true, attributeFilter: ['class'] })
      }
      g.events.on('capy:incident', () => { if (L.incident < 0) L.incident = +(g.state.time - L.t0).toFixed(1) })
    })
    // the naive drive: 180 s in 3 s legs, each leg one page.evaluate under
    // the harness's 20 s ceiling
    const DIRS = ['KeyA', 'KeyD']
    for (let leg = 0; leg < 60; leg++) {
      const turn = DIRS[leg % 2], turnMs = 250 + (leg * 137) % 900
      const hop = leg % 2 === 1, grab = leg % 3 === 2, run = leg % 5 === 4
      await page.keyboard.down('KeyW')
      if (run) await page.keyboard.down('ShiftLeft')
      await page.keyboard.down(turn)
      await page.waitForTimeout(turnMs)
      await page.keyboard.up(turn)
      await page.waitForTimeout(900)
      if (hop) { await page.keyboard.press('Space'); await page.waitForTimeout(400) }
      if (grab) { await page.keyboard.press('KeyE'); await page.waitForTimeout(300) }
      await page.waitForTimeout(Math.max(200, 3000 - turnMs - 900 - (hop ? 400 : 0) - (grab ? 300 : 0)))
      if (run) await page.keyboard.up('ShiftLeft')
      await page.keyboard.up('KeyW')
    }
    const row = await page.evaluate(() => {
      const g = window.__capy, L = window.__l4fm
      const perMin = [0, 0, 0], say = [0, 0, 0], note = [0, 0, 0]
      for (const t of L.toasts) { const m = Math.min(2, Math.floor(t.t / 60)); perMin[m]++; if (t.kind === 'note') note[m]++; else say[m]++ }
      return { chapter: g.biome.current, elapsed: +(g.state.time - L.t0).toFixed(0), perMin, say, note,
               first: L.toasts.filter(t => t.t < 60).map(t => t.t + ' ' + t.kind + ': ' + t.text),
               moments: L.moments, firstIncident: L.incident,
               finds: typeof g.hud.findAudit === 'function' ? g.hud.findAudit().n : (g.state.finds || null),
               err: g.state.lastError || null }
    })
    row.started = started
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4-first-minute.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
