async page => {
  // ROADMAP-WOW2 W6 — the nineteen arrival frames, re-shot. Batch 2 of 2
  // (kowloon..hanoi, nine chapters). Same pattern as batch 1.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage['capy3.prefs.v1'] = JSON.stringify({ v: 1, pf: 1 }) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1200)
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  await page.waitForTimeout(9000)
  const NAMES = ['kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const out = { started, errs, shots: [] }
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i]
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    await page.screenshot({ path: 'qa/wow2-arrival-' + name + '.png' })
    out.shots.push(name)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-arrivals-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
