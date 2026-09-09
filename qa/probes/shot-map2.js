async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4000)
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(2500)
  let buf = await page.screenshot({ clip: { x: 1060, y: 500, width: 220, height: 220 } })
  await page.evaluate(async (a) => { await fetch('/shot?name=mapx-syd', { method: 'POST', body: 'data:image/png;base64,' + a }) }, buf.toString('base64'))
  buf = await page.screenshot()
  await page.evaluate(async (a) => { await fetch('/shot?name=hud-syd', { method: 'POST', body: 'data:image/png;base64,' + a }) }, buf.toString('base64'))
  const info = await page.evaluate(() => {
    const d = document.querySelector('.capyui-mapdist')
    return { cls: d.className, txt: d.textContent, started: window.__capy.state.started, err: window.__capy.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=mapinfo2.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
