async page => {
  await page.keyboard.press('KeyK'); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__capy.biome.switchTo('sahara') })
  await page.waitForTimeout(9000)
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1600)
  const out = { on: await page.evaluate(() => window.__capy.hud.photoAudit().on), biome: await page.evaluate(() => window.__capy.biome.current) }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-23.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
