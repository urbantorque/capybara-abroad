async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload()
  await page.waitForTimeout(4500)
  let buf = await page.screenshot()
  await page.evaluate(async (a) => { await fetch('/shot?name=title-carry', { method: 'POST', body: 'data:image/png;base64,' + a }) }, buf.toString('base64'))
  const info = await page.evaluate(() => ({
    h: document.querySelector('.capyui-card').getBoundingClientRect().height,
    carry: !!document.querySelector('.capyui-carry'),
    started: window.__capy.state.started }))
  await page.evaluate(async (o) => { await fetch('/shot?name=t3.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
