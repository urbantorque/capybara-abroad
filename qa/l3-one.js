async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(4800)
  await page.keyboard.press('Digit8')
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l3-one-a.png' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l3-one-b.png' })
  const o = await page.evaluate(() => { const g = window.__capy; const c = g.camera.position; const p = g.capy.position; return { cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], capy: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] } })
  await page.evaluate((o) => fetch('/shot?name=l3-one.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), o)
}
