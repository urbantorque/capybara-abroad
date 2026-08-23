async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload()
  await page.waitForTimeout(4000)
  await page.evaluate(() => { const d = document.querySelector('.capyui-more'); if (d) d.open = true })
  await page.waitForTimeout(500)
  let b = await page.screenshot()
  await page.evaluate(async (d) => { await fetch('/shot?name=title-more', { method: 'POST', body: 'data:image/png;base64,' + d }) }, b.toString('base64'))
  await page.setViewportSize({ width: 390, height: 780 })
  await page.waitForTimeout(700)
  b = await page.screenshot()
  await page.evaluate(async (d) => { await fetch('/shot?name=title-mob', { method: 'POST', body: 'data:image/png;base64,' + d }) }, b.toString('base64'))
  await page.evaluate(() => { const g = document.querySelector('.capyui-go'); if (g) g.click() })
  await page.waitForTimeout(700)
  b = await page.screenshot()
  await page.evaluate(async (d) => { await fetch('/shot?name=title-mob2', { method: 'POST', body: 'data:image/png;base64,' + d }) }, b.toString('base64'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => ({
    p1: document.querySelector('.capyui-p1').hidden, p2: document.querySelector('.capyui-p2').hidden,
    started: window.__capy.state.started }))
  await page.evaluate(async (o) => { await fetch('/shot?name=titleinfo2.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
