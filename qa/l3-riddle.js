async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(7000)
  const aim = () => page.evaluate(() => { const li = document.querySelector('.capyui-task:not(.capyui-hidden):not(.capyui-way)'); const a = li && li.querySelector('.capyui-aim'); return { row: li && li.querySelector('.capyui-txt').textContent, aimOn: !!(a && a.classList.contains('on')), dist: a && a.querySelector('span') && a.querySelector('span').textContent } })
  const a1 = await aim()                 // the first row: arrow
  await page.evaluate(() => window.__capy.hud.completeTask('lantern-topple'))
  await page.waitForTimeout(3000)
  const a2 = await aim()                 // the second row: no arrow yet
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(600)
  const a3 = await aim()                 // F: the arrow (and possibly the next row)
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l3-riddle.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { a1, a2, a3, err, errs })
}
