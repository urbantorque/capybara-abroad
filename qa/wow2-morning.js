async page => {
  // ROADMAP-WOW2 N4 — THE MORNING AFTER. Two reads: the opening plays once
  // on a fresh file (game.openAudit) and is skipped by a keypress; a
  // restored file (with a real save, any progress) never arms it. Then a
  // forced `fin` save proves the again-line's fin epilogue.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }

  // ---- 1. fresh file: the opening arms and can be skipped by a key ------
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1300)   // past the 700ms setTimeout that starts it
  out.freshArmed = await page.evaluate(() => window.__capy.openAudit())
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  out.freshSkipped = await page.evaluate(() => window.__capy.openAudit())

  // ---- 2. a restored file never arms it ----------------------------------
  const oneTaskId = (await page.evaluate(() => (window.__capy.tasksInChapter(1) || [])[0])) || null
  await page.addInitScript((tid) => {
    try { localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: tid ? [tid] : [], seen: [1], recs: {}, ms: 0 })) } catch (e) {}
  }, oneTaskId)
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(1500)
  out.restoreNeverArmed = await page.evaluate(() => window.__capy.openAudit())

  // ---- 3. the fin epilogue on the again line -----------------------------
  // Force every keepsake, force `fin`, cross away and back to sydney.
  const idsAll = await page.evaluate(async () => {
    const g = window.__capy
    const out = {}
    for (let k = 1; k <= 19; k++) out[k] = g.tasksInChapter(k) || []
    return out
  })
  const allTasks = Object.values(idsAll).flat()
  await page.addInitScript((tasks) => {
    try { localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: tasks, seen: [], recs: {}, ms: 0, fin: 1 })) } catch (e) {}
  }, allTasks)
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(4500)
  out.shelfOnFin = await page.evaluate(() => window.__capy.shelfAudit())
  // mark kyoto "seen" so a return there reads as a return, then cross away
  // and back — the fin tail only appears on the SECOND arrival.
  await page.evaluate((n) => window.__capy.hud.cross(n), 'kyoto')
  await page.waitForTimeout(9500)
  await page.evaluate(() => { for (const id of window.__capy.tasksInChapter(4)) window.__capy.completeTask(id, true) })
  await page.evaluate((n) => window.__capy.hud.cross(n), 'sydney')
  await page.waitForTimeout(9500)
  await page.evaluate((n) => window.__capy.hud.cross(n), 'kyoto')
  await page.waitForTimeout(2600)   // sysFADE_CARD_LAG then the news line paints
  out.againLineOnFin = await page.evaluate(() => {
    const el = document.querySelector('.capyui-placenews')
    return el ? el.textContent : null
  })

  await page.screenshot({ path: 'qa/wow2-morning-fin.png' })

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-morning', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
