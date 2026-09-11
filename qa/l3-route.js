async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /choose a place|go somewhere else/i.test(x.textContent)); b.click() })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l3-route.png' })
  const r = await page.evaluate(() => ({ dots: document.querySelectorAll('.capyui-routedot').length, seen: document.querySelectorAll('.capyui-routedot.seen').length, h: (document.querySelector('.capyui-route') || {}).clientHeight }))
  await page.evaluate((o) => fetch('/shot?name=l3-route.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { r, errs })
}
