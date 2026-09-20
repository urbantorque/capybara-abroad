async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(3000)

  const samples = []
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(350)
    const r = await page.evaluate(() => {
      const g = window.__capy, T = g.THREE
      const mesh = g.weather && g.weather.burstAudit ? g.weather.burstAudit().mesh : null
      if (!mesh) return null
      const m = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3()
      let min = 1e9, max = 0, nearZero = 0, n = Math.min(mesh.count, 160)
      for (let i = 0; i < n; i++) {
        mesh.getMatrixAt(i, m)
        m.decompose(pos, q, sc)
        if (sc.x < min) min = sc.x
        if (sc.x > max) max = sc.x
        if (sc.x < 0.006) nearZero++     // base pollen size is 0.055*0.048 ~= 0.0026..0.06; a genuine collapse reads far under the smallest base value
      }
      return { min: +min.toFixed(4), max: +max.toFixed(4), n, nearZero }
    })
    samples.push(r)
  }
  out.samples = samples
  await page.evaluate(async (o) => { await fetch('/shot?name=w1-mote-footprint.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
