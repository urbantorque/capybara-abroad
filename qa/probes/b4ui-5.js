async page => {
  const out = {}
  out.a = await page.evaluate(() => window.__capy.hud.photoAudit())
  await page.mouse.click(640, 400)
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1400)
  out.b = await page.evaluate(() => window.__capy.hud.photoAudit())
  await page.keyboard.press('Enter'); await page.waitForTimeout(2500)
  out.c = await page.evaluate(() => window.__capy.hud.photoAudit())
  out.alb = await page.evaluate(() => window.__capy.hud.albumAudit())
  await page.keyboard.press('KeyK'); await page.waitForTimeout(800)
  out.d = await page.evaluate(() => window.__capy.hud.photoAudit())
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
