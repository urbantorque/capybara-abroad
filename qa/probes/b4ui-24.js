async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const g = document.querySelector('button.capyui-go'); if (g) g.click() })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() })
  await page.waitForTimeout(7000)
  await page.evaluate(() => { window.__capy.biome.switchTo('sahara') })
  await page.waitForTimeout(10000)
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1800)
  const out = { on: await page.evaluate(() => window.__capy.hud.photoAudit().on), biome: await page.evaluate(() => window.__capy.biome.current) }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-24.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
