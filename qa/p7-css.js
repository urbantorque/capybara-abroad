async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  const out = { errs: [] }

  // The title card, before anything is pressed.
  await page.screenshot({ path: 'qa/p7-title.png' })

  // ---- COMPUTED styles, not source values ---------------------------------
  // A malformed token would not throw: the browser drops the whole declaration
  // and the element silently loses its corner or its shadow. The only thing
  // that proves a token arrived is what the element computes to.
  out.css = await page.evaluate(() => {
    const want = ['capyui-card', 'capyui-todo', 'capyui-jrcard', 'capyui-go',
                  'capyui-pick', 'capyui-ledrow', 'capyui-keep', 'capyui-done']
    const rows = {}
    for (const cls of want) {
      const el = document.querySelector('.' + cls)
      if (!el) { rows[cls] = null; continue }
      const c = getComputedStyle(el)
      rows[cls] = { radius: c.borderTopLeftRadius, shadow: (c.boxShadow || '').slice(0, 60),
                    font: c.fontSize }
    }
    // ...and nothing anywhere may have computed to an EMPTY radius or shadow
    // where the source asked for one: that is the shape a dropped declaration
    // takes.
    let empties = 0
    for (const el of document.querySelectorAll('.capyui *')) {
      const c = getComputedStyle(el)
      if (c.borderTopLeftRadius === '') empties++
    }
    return { rows: rows, empties: empties }
  })

  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6500)
  await page.screenshot({ path: 'qa/p7-hud.png' })
  await page.evaluate(async () => {
    const g = window.__capy
    for (const id of g.hud.taskIds(1).slice(0, 6)) { try { g.hud.completeTask(id) } catch (e) {} }
    await new Promise(r => setTimeout(r, 1200))
    g.hud.ledger()
    await new Promise(r => setTimeout(r, 1000))
  })
  await page.screenshot({ path: 'qa/p7-ledger.png' })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p7-css.json', { method: 'POST', body: s })
  }, out)
}
