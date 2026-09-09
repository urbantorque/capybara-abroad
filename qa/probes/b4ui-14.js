async page => {
  const out = {}
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  const act = () => page.evaluate(() => { const e = document.activeElement; if (!e) return null
    return { tag: e.tagName, c: (typeof e.className === 'string' && e.className) || '', t: (e.textContent || '').trim().slice(0, 24) } })
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1000)
  // tab to the ledger button the way a keyboard player would
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('Tab')
    const a = await act()
    if (a && /jrled/.test(a.c) && /laid out/.test(a.t)) { out.reachedLedBtnAfterTabs = i + 1; break }
  }
  out.before = await act()
  await page.keyboard.press('Enter'); await page.waitForTimeout(1100)
  out.opened = await act()
  out.ledFocusables = await page.evaluate(() => {
    const led = document.querySelector('.capyui-led')
    return Array.from(led.querySelectorAll('button,a[href],summary,input,[tabindex]:not([tabindex="-1"])')).map(e => ({ tag: e.tagName, c: (typeof e.className === 'string' && e.className) || '', t: (e.textContent || '').trim().slice(0, 20) }))
  })
  out.jrStillOpen = await page.evaluate(() => document.querySelector('.capyui-jr').classList.contains('show'))
  await page.keyboard.press('Escape'); await page.waitForTimeout(900)
  out.afterEsc = await act()
  out.jrAfterEsc = await page.evaluate(() => document.querySelector('.capyui-jr').classList.contains('show'))
  out.pausedAfter = await page.evaluate(() => window.__capy.state.paused)
  // does Tab do anything inside the ledger?
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(800)
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /laid out/.test(x.textContent)); if (b) b.click() })
  await page.waitForTimeout(900)
  const seq = []
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); seq.push((await act()).c || (await act()).tag) }
  out.ledTabSeq = seq
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-14.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
