async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)) })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  const ok = await page.evaluate(() => !!window.__capy)
  await page.evaluate((o) => fetch('/shot?name=l3-boot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { ok, errs: errs.slice(0, 6) })
}
