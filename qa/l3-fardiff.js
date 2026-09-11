async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(4800)
  await page.keyboard.press('Equal')
  await page.waitForTimeout(8000)
  const a = await page.evaluate(() => { const P = window.__capy.post.params; return { air: P.air, airMax: P.airMax, airGnd: P.airGnd, farDark: P.farDark, d0: P.farDist0, d1: P.farDist1, dof: P.dof } })
  await page.screenshot({ path: 'qa/l3-far-a.png' })
  await page.evaluate(() => { window.__capy.state.noAir = true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'qa/l3-far-off.png' })
  await page.evaluate(() => { window.__capy.state.noAir = false; window.__capy.__farX = 1 })
  await page.waitForTimeout(300)
  const out = { a }
  await page.evaluate((o) => fetch('/shot?name=l3-fardiff.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
