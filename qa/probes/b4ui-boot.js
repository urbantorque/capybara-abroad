async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(5000)
  const out = {}
  await page.evaluate(() => {
    const p2 = document.querySelector('.capyui-p2')
    if (p2 && !p2.hasAttribute('hidden')) { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() }
    else { const g = document.querySelector('button.capyui-go'); if (g) g.click() }
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() })
  await page.waitForTimeout(5000)
  out.started = await page.evaluate(() => !!(window.__capy && window.__capy.state && window.__capy.state.started))
  out.alb0 = await page.evaluate(() => window.__capy.hud.albumAudit().n)
  if (out.alb0 < 1) {
    await page.mouse.click(640, 400); await page.waitForTimeout(400)
    const on = await page.evaluate(() => window.__capy.hud.photoAudit().on)
    if (!on) { await page.keyboard.press('KeyK'); await page.waitForTimeout(1300) }
    await page.keyboard.press('Enter'); await page.waitForTimeout(2200)
    await page.keyboard.press('KeyK'); await page.waitForTimeout(900)
  }
  out.alb = await page.evaluate(() => window.__capy.hud.albumAudit())
  out.photo = await page.evaluate(() => window.__capy.hud.photoAudit())
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-boot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
