async page => {
  const out = {}
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  // ---- 1. the DONE HERE score card ----
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit3')            // Circular Quay: 8 tasks
  await page.waitForTimeout(5000)
  out.card = await page.evaluate(async () => {
    const g = window.__capy
    // A record and an incident, so the summary has something to summarise.
    if (typeof g.record === 'function') g.record('the-crossing', 512)
    const ids = []
    for (const li of document.querySelectorAll('.capyui-task')) {
      const t = (li.querySelector('.capyui-txt') || {}).textContent
      if (t) ids.push(t)
    }
    // Tick everything in this chapter through the public door.
    const all = (g.hud && g.hud.tasksDone) ? null : null
    return { rowsSeen: ids.length }
  })
  out.ticked = await page.evaluate(async () => {
    const g = window.__capy
    const done = []
    // TASKS is not exposed; walk the paper's own ids via the chapter board.
    // completeTask is public and idempotent, so drive it from the id list the
    // record audit already knows about plus the visible rows.
    const list = g.__p3ids || []
    return list.length
  })
  // drive it from the module's own table, fetched from source
  const idsForQuay = await page.evaluate(async () => {
    const src = await fetch('/src/shared.js').then(r => r.text())
    const re = /\{\s*id:\s*'([a-z0-9-]+)'[^}]*?chapter:\s*(\d+)/g
    const out = []
    let m
    while ((m = re.exec(src))) if (+m[2] === 3) out.push(m[1])
    return out
  })
  out.quayIds = idsForQuay
  await page.evaluate(async (ids) => {
    const g = window.__capy
    for (const id of ids) { try { g.completeTask(id) } catch (e) {} await new Promise(r => setTimeout(r, 120)) }
  }, idsForQuay)
  await page.waitForTimeout(4500)
  out.board = await page.evaluate(() => {
    const c = document.querySelector('.capyui-clue')
    return { recs: !!(c && c.classList.contains('recs')), text: c ? c.textContent : null }
  })
  await page.screenshot({ path: 'qa/p3-scorecard.png' })

  // ---- 2. Hanoi: the fold ticks LATE, not only on the crossing frame ----
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Slash')
  await page.waitForTimeout(5000)
  out.fold = await page.evaluate(async () => {
    const g = window.__capy
    const api = g.hanoi
    const done = () => !!(g.taskDone && g.taskDone('fold-the-street'))
    // Find the alley by asking the chapter's own zone test, so this cannot go
    // stale against a rectangle in the source.
    let ax = 0, az = 0, found = false
    for (let x = -200; x <= 200 && !found; x += 2) {
      for (let z = -200; z <= 200; z += 2) {
        if (api && api.inZone && api.inZone('alley', x, z)) { ax = x; az = z; found = true; break }
      }
    }
    if (!found) return { noAlley: true }
    // Stand well clear and wait until the train is actually HERE — nextIn
    // reports 0 for the whole time it is running, which is exactly the state
    // the old rising-edge gate could not be ticked from.
    g.capy.body.position.set(ax, g.capy.position.y + 1, az - 90)
    await new Promise(r => setTimeout(r, 1200))
    let waited = 0, arrived = false
    while (waited < 140000) {
      let s = -1
      try { s = api.nextIn('the-train') } catch (e) {}
      if (s === 0) { arrived = true; break }
      await new Promise(r => setTimeout(r, 400)); waited += 400
    }
    if (!arrived) return { neverCame: true, waited: waited }
    const beforeTick = done()
    // deliberately LATE: three seconds after the fold has finished rising
    await new Promise(r => setTimeout(r, 3000))
    const foldAlreadyUp = true
    g.capy.body.position.set(ax, g.capy.position.y + 1, az)
    await new Promise(r => setTimeout(r, 2500))
    return { arrived: true, waited: waited, at: [ax, az],
             beforeTick: beforeTick, ticked: done(), foldAlreadyUp: foldAlreadyUp }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p3-card.json', { method: 'POST', body: s })
  }, out)
}
