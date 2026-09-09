async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    const b = window.__capy.capy.body
    b.position.set(-58, 1.4, 60); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(2500)
  let buf = await page.screenshot({ clip: { x: 1060, y: 500, width: 220, height: 220 } })
  await page.evaluate(async (a) => { await fetch('/shot?name=mapx-far', { method: 'POST', body: 'data:image/png;base64,' + a }) }, buf.toString('base64'))
  const info = await page.evaluate(() => ({ txt: document.querySelector('.capyui-mapdist').textContent }))
  await page.evaluate(async (o) => { await fetch('/shot?name=mapinfo3.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
