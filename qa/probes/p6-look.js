async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)

  // the act header on the paper
  await page.screenshot({ path: 'qa/p6-todo.png' })

  // the closing card
  await page.evaluate(async () => {
    const g = window.__capy
    for (const id of g.hud.taskIds(1)) { try { g.hud.completeTask(id) } catch (e) {} }
    await new Promise(r => setTimeout(r, 1400))
  })
  await page.screenshot({ path: 'qa/p6-done.png' })

  // ...and a second chapter finished, so the ledger has two leaves with a
  // sentence on each and can be judged as a page rather than as one row
  await page.evaluate(async () => {
    const g = window.__capy
    await new Promise(r => setTimeout(r, 2600))
    for (const id of g.hud.taskIds(15)) { try { g.hud.completeTask(id) } catch (e) {} }
    await new Promise(r => setTimeout(r, 2600))
    g.hud.ledger()
    await new Promise(r => setTimeout(r, 1200))
  })
  await page.screenshot({ path: 'qa/p6-ledger.png' })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p6-look.json', { method: 'POST', body: s })
  }, { errs: errs })
}
