async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(10000)
  const atRest = await page.evaluate(() => ({
    p: Math.round(window.__capy.camInfo.pitch * 1800 / Math.PI) / 10,
    sky: Math.round(window.__capy.camInfo.sky * 100) / 100,
    rest: Math.round(window.__capy.camInfo.rest * 100) / 100 }))
  await page.keyboard.down('KeyV')
  await page.waitForTimeout(3500)
  const held = await page.evaluate(() => ({
    p: Math.round(window.__capy.camInfo.pitch * 1800 / Math.PI) / 10,
    sky: Math.round(window.__capy.camInfo.sky * 100) / 100 }))
  await page.keyboard.up('KeyV')
  await page.waitForTimeout(3500)
  const after = await page.evaluate(() => ({
    p: Math.round(window.__capy.camInfo.pitch * 1800 / Math.PI) / 10,
    sky: Math.round(window.__capy.camInfo.sky * 100) / 100,
    rest: Math.round(window.__capy.camInfo.rest * 100) / 100 }))
  await page.evaluate(o => fetch('/shot?name=vz-v.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }),
    { atRest: atRest, heldV: held, released: after })
  await page.waitForTimeout(300)
}
