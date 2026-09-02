async page => {
  // D1: the resting frame of the chapters the sky and shadow work is aimed at,
  // plus a crane-up in two of them so the dome's lobe and horizon band are in
  // shot at all — at the resting 41-degree pitch the sky is a strip.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }
  const KEYS = ['Digit1', 'Digit4', 'Digit6', 'Digit0', 'Digit8', 'BracketRight']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(12000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      const a = g.hud && g.hud.canopyAudit ? g.hud.canopyAudit() : {}
      return { biome: g.biome.current, shade: a.shade, half: a.shadowHalf,
               calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }
    })
    await page.screenshot({ path: 'qa/d1-' + info.biome + '.png' })
    out.rows.push(Object.assign({ key: key }, info))
  }
  await page.evaluate((o) => fetch('/shot?name=d1-shots.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign(o, { errs: [] })))))}), out)
}
