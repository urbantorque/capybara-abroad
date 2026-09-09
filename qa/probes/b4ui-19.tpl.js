async page => {
  const SCAN = /*SCAN*/
  const scan = () => page.evaluate(SCAN)
  const out = { panels: [], boot: null, esc: [] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForTimeout(8000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(700)
  out.boot = await page.evaluate(() => ({ rm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    titleShown: !!document.querySelector('.capyui-title') }))
  await page.evaluate(() => { const g = document.querySelector('button.capyui-go'); if (g) g.click() })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() })
  await page.waitForTimeout(7000)
  out.started = await page.evaluate(() => !!window.__capy.state.started)
  out.alb = await page.evaluate(() => window.__capy.hud.albumAudit().n)
  const openState = () => page.evaluate(() => {
    const q = c => { const e = document.querySelector(c); if (!e) return null
      const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !e.hasAttribute('hidden') && !e.inert }
    return { jr: q('.capyui-jr'), led: q('.capyui-led'), alb: q('.capyui-alb') } })
  for (const [name, act] of [['journal', async () => { await page.keyboard.press('KeyJ') }],
                             ['ledger', async () => { await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /laid out/.test(x.textContent)); if (b) b.click() }) }],
                             ['album', async () => { await page.keyboard.press('KeyJ'); await page.waitForTimeout(700); await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /album/.test(x.textContent)); if (b) b.click() }) }],
                             ['photo', async () => { await page.keyboard.press('KeyK') }]]) {
    await act(); await page.waitForTimeout(1300)
    const r = await scan(); r.size = '1280x720-RM'; r.panel = name; r.open = await openState()
    if (name === 'photo') r.photoOn = await page.evaluate(() => window.__capy.hud.photoAudit().on)
    out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(800)
    out.esc.push({ after: name, st: await openState(), photo: await page.evaluate(() => window.__capy.hud.photoAudit().on) })
  }
  out.contrast = await page.evaluate(() => document.querySelectorAll('.capyui *').length)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-19.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
