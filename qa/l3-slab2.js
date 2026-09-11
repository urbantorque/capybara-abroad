async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }
  const KEYS = ['Slash', 'Digit0', 'Equal']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      g.tick(1 / 60, true)
      const r = g.renderer.info.render
      return { biome: g.biome.current, started: !!g.state.started,
               calls: r.calls, tris: r.triangles,
               err: g.state.lastError || null }
    })
    await page.screenshot({ path: 'qa/l3-slab2-' + info.biome + '.png' })
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'qa/l3-slab2-' + info.biome + '-walk.png' })
    out.rows.push(Object.assign({ key: key }, info))
  }
  out.errs = errs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l3-slab2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
