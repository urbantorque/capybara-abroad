async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [] }
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)

  // ---- 2. the act header is the live movement's kick ----------------------
  // Digit1..9 then Digit0 = chapters 1..10. Palawan is 12 -> Equal.
  for (const [name, key] of [['palawan', 'Equal'], ['manly', 'BracketRight'], ['rio', 'Digit6']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(6500)
    out['act_' + name] = await page.evaluate(() => {
      const g = window.__capy
      const c = document.querySelector('.capyui-todo')
      const h = c ? c.querySelector('h2') : null
      const rows = Array.from(document.querySelectorAll('.capyui-todo li'))
        .filter(e => !e.classList.contains('capyui-hidden'))
      return { biome: g.biome.current, head: h ? h.textContent : null,
               rows: rows.length }
    })
  }

  // ---- 3. the note reaches the ledger and the done card -------------------
  out.note = await page.evaluate(async () => {
    const g = window.__capy
    // Finish the live chapter outright, which is the only state that puts a
    // note on a leaf: the sentence is past tense about a place that is over.
    const n = g.CHAPTERS ? 1 : 1
    const ids = g.hud.taskIds ? g.hud.taskIds(1) : []
    for (const id of ids) { try { g.hud.completeTask(id) } catch (e) {} }
    await new Promise(r => setTimeout(r, 2200))
    const done = document.querySelector('.capyui-donenote')
    const doneTxt = done ? done.textContent : null
    // ...and then open the ledger and read the leaf
    try { g.hud.ledger ? g.hud.ledger() : null } catch (e) {}
    await new Promise(r => setTimeout(r, 900))
    const leaf = Array.from(document.querySelectorAll('.capyui-lednote')).map(e => e.textContent)
    return { doneNote: doneTxt, leafNotes: leaf, ids: ids.length }
  })

  // ---- 4. the per-chapter pools resolve to the chapter, not the neutral ---
  for (const [name, key] of [['venice', 'Digit0'], ['kowloon', 'Minus']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(6500)
    out['say_' + name] = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current,
               wary: g.sayAudit ? g.sayAudit('wary') : null,
               incident: g.sayAudit ? g.sayAudit('incident') : null,
               startled: g.sayAudit ? g.sayAudit('startled') : null }
    })
  }

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p6-words.json', { method: 'POST', body: s })
  }, out)
}
