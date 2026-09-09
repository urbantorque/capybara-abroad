async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit4')          // Kyoto: torii-run is timed
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/p3-paper-kyoto.png' })

  // ...and Iceland, where the top row carries a countdown as well as a par
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit7')
  await page.waitForTimeout(5000)
  for (let i = 0; i < 10; i++) {
    const c = await page.evaluate(() => (document.querySelector('.capyui-clue') || {}).textContent || '')
    if (/next in/.test(c)) break
    await page.keyboard.press('KeyF')
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/p3-paper-iceland.png' })

  const box = await page.evaluate(() => {
    const m = document.querySelector('.capyui-meas')
    if (!m) return { none: true }
    const r = m.getBoundingClientRect()
    const cs = getComputedStyle(m)
    return { w: Math.round(r.width), h: Math.round(r.height), size: cs.fontSize,
             color: cs.color, opacity: cs.opacity, text: m.textContent }
  })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p3-shot.json', { method: 'POST', body: s })
  }, box)
}
