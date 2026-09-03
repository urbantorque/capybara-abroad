async page => {
  // THE HOUR MOVES — sysACT_LIGHT, measured and photographed.
  //
  // Two chapters, three movements each, and the light read at every one:
  // Monte Carlo (twenty past eight, and it gets later) and Sơn Đoòng (the
  // mouth, the middle, and nine kilometres in). The acts are advanced by
  // completing their tasks through `game.completeTask` — the same call the
  // chapters use — and the task list comes from shared.js itself, imported in
  // the page, so this cannot go stale against a retuned chapter.
  //
  // The photographs are the point. `k` moving from 0 to 1 is a number; whether
  // six seconds of grade is a change anybody can see is not.
  // HARNESS TRAP 8: the game saves to localStorage and completed tasks survive
  // a reload — so the SECOND run of this probe opened Monte Carlo already in
  // its third movement, with the card reading 13/15, and photographed the end
  // of the chapter three times. Cleared on every navigation (trap 10 says that
  // is exactly wrong for a save test and exactly right for this one).
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })


  for (const [key, tag, ch] of [['Period', 'monaco', 18], ['Quote', 'cave', 16]]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = { tag: tag, steps: [] }
    row.steps.push(await page.evaluate(() => window.__capy.actLight()))
    // page.screenshot, NOT canvas.toDataURL: harness trap 12. The canvas has no
    // preserveDrawingBuffer, so toDataURL comes back blank white — the first run
    // of this probe wrote six byte-identical 21 956-byte PNGs of nothing.
    await page.screenshot({ path: 'qa/d7a-' + tag + '-1.png' })
    for (let act = 1; act <= 2; act++) {
      await page.evaluate(async (o) => {
        const m = await import('/src/shared.js')
        const g = window.__capy
        // TASKS, not tasksInChapter — the latter returns ids and the ACT is on
        // the definition, which is the only thing this probe is steering by.
        for (const t of m.TASKS) {
          if ((t.chapter || 1) !== o.ch) continue
          if (((t.act) || 1) <= o.act) g.completeTask(t.id)
        }
      }, { ch: ch, act: act })
      // Long enough for the six-second walk plus the grade's own damp.
      await page.waitForTimeout(11000)
      row.steps.push(await page.evaluate(() => window.__capy.actLight()))
      await page.screenshot({ path: 'qa/d7a-' + tag + '-' + (act + 1) + '.png' })
    }
    row.err = await page.evaluate(() => window.__capy.state.lastError || '')
    out.rows.push(row)
  }
  await page.evaluate(o => fetch('/shot?name=d7-act.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
