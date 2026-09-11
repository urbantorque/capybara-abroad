async page => {
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(6000)
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy
    const t0 = performance.now(); const rows = []
    const iv = setInterval(() => { const a = g.musAudit(); rows.push([Math.round((performance.now() - t0) / 1000), a.melN, a.melNext, a.melCells, a.melDeg, a.throws])
      if (performance.now() - t0 > 45000) { clearInterval(iv); res(rows) } }, 3000)
  }))
  await page.evaluate((o) => fetch('/shot?name=l3-mel2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), r)
}
