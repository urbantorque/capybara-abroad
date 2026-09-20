async page => {
  // ROADMAP-WOW2 W6 — the nineteen arrival frames, re-shot after all six
  // waves (V1-V6, N1-N4, T). Batch 1 of 2 (sydney..venice, ten chapters).
  // Fresh boot, arrival via hud.cross (the only honest arrival), a raw
  // page.screenshot at the resting lens — no composite tricks, this is
  // exactly what a player sees.
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
  const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice']
  const out = { started, errs, shots: [] }
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i]
    if (i === 0) { await page.waitForTimeout(9000) }
    else { await page.evaluate((n) => window.__capy.hud.cross(n), name); await page.waitForTimeout(9500) }
    await page.screenshot({ path: 'qa/wow2-arrival-' + name + '.png' })
    out.shots.push(name)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-arrivals-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
