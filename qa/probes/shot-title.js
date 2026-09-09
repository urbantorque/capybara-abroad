async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(1500)
  const b1 = await page.screenshot()
  await page.evaluate(async (d) => { await fetch('/shot?name=title1', { method: 'POST', body: 'data:image/png;base64,' + d }) }, b1.toString('base64'))
  await page.evaluate(() => { const g = document.querySelector('.capyui-go'); if (g) g.click() })
  await page.waitForTimeout(900)
  const b2 = await page.screenshot()
  await page.evaluate(async (d) => { await fetch('/shot?name=title2', { method: 'POST', body: 'data:image/png;base64,' + d }) }, b2.toString('base64'))
  const info = await page.evaluate(() => {
    const c = document.querySelector('.capyui-card')
    const p1 = document.querySelector('.capyui-p1'), p2 = document.querySelector('.capyui-p2')
    return { cardH: c.getBoundingClientRect().height, p1h: p1.hidden, p2h: p2.hidden,
      started: window.__capy.state.started, err: window.__capy.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=titleinfo.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
