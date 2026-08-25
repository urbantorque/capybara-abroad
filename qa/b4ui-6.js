async page => {
  const out = {}
  out.a = await page.evaluate(() => window.__capy.hud.photoAudit())
  if (!out.a.on) { await page.keyboard.press('KeyK'); await page.waitForTimeout(1200) }
  out.b = await page.evaluate(() => window.__capy.hud.photoAudit())
  await page.keyboard.press('Enter'); await page.waitForTimeout(2500)
  out.c = await page.evaluate(() => window.__capy.hud.photoAudit())
  out.alb = await page.evaluate(() => window.__capy.hud.albumAudit())
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
