async page => {
  const out = { roles: null, jrTab: [], ledTab: [], albTab: [], focusIn: {}, restore: {} }
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  const act = () => page.evaluate(() => { const e = document.activeElement; if (!e) return null
    const b = e.getBoundingClientRect()
    const inJr = !!(e.closest && e.closest('.capyui-jrcard')), inLed = !!(e.closest && e.closest('.capyui-led')), inAlb = !!(e.closest && e.closest('.capyui-alb'))
    return { tag: e.tagName, c: (typeof e.className === 'string' && e.className) || '', t: (e.textContent || '').trim().slice(0, 22), w: Math.round(b.width), h: Math.round(b.height), inJr, inLed, inAlb } })

  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1000)
  out.focusIn.journal = await act()
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); out.jrTab.push(await act()) }
  // roles, with the journal open
  out.roles = await page.evaluate(() => {
    const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
    const bad = []
    document.querySelectorAll('[role]').forEach(el => {
      const r = el.getAttribute('role'), t = el.tagName
      if ((r === 'listitem' || r === 'presentation' || r === 'none') && (t === 'BUTTON' || t === 'A')) bad.push(['role-eats-' + t, cls(el), r])
      if (r === 'button' && !el.getAttribute('aria-label') && !(el.textContent || '').trim()) bad.push(['nameless-role-button', cls(el)])
      if (r === 'dialog' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) bad.push(['nameless-dialog', cls(el)])
      if (r === 'button' && t !== 'BUTTON' && el.tabIndex < 0) bad.push(['role-button-not-focusable', cls(el), 'tabIndex=' + el.tabIndex])
    })
    document.querySelectorAll('button').forEach(el => {
      if (!el.getAttribute('aria-label') && !(el.textContent || '').trim()) bad.push(['nameless-button', cls(el)])
      if (el.getAttribute('role') && el.getAttribute('role') !== 'button') bad.push(['button-with-role-' + el.getAttribute('role'), cls(el)])
    })
    const summ = []
    document.querySelectorAll('summary').forEach(el => summ.push({ c: cls(el), t: el.textContent.trim().slice(0, 20), tab: el.tabIndex }))
    const imgs = []
    document.querySelectorAll('img,canvas').forEach(el => imgs.push({ tag: el.tagName, alt: el.getAttribute('alt'), label: el.getAttribute('aria-label'), hid: el.getAttribute('aria-hidden') }))
    return { bad, summ, imgs, liveRegions: Array.from(document.querySelectorAll('[aria-live],[role="status"],[role="alert"]')).map(e => cls(e) + ':' + (e.getAttribute('aria-live') || e.getAttribute('role'))) }
  })
  // ledger focus
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /laid out/.test(x.textContent)); if (b) b.click() })
  await page.waitForTimeout(1000)
  out.focusIn.ledger = await act()
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); out.ledTab.push(await act()) }
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  out.restore.afterLedger = await act()
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(800)
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /album/.test(x.textContent)); if (b) b.click() })
  await page.waitForTimeout(1000)
  out.focusIn.album = await act()
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); out.albTab.push(await act()) }
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  out.restore.afterAlbum = await act()
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-13.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
