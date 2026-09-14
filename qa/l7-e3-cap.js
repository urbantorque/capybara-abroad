async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, shots: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const info = async () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const xs = pts.map(p => (p.x + 1) / 2 * 1280), ys = pts.map(p => (1 - p.y) / 2 * 760)
    const ci = g.camInfo
    return { box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(0)), cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
      capR: ci.capR, clear: +ci.clear.toFixed(2), rest: +ci.rest.toFixed(2), orbit: ci.orbit, err: g.state.lastError ? String(g.state.lastError).slice(0, 100) : null }
  })
  // the reviewer's settled-frame recipe (l7r-art-shots.js): arrival, W 3.2 s, 14 s still —
  // then the same rest frame with the capsule on and off, 300 ms apart
  for (const c of ['sydney', 'cali', 'sahara', 'kowloon']) {
    if (c !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), c); await page.waitForTimeout(9000) }
    else await page.waitForTimeout(2500)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    out.shots[c + '-on'] = await info()
    await page.screenshot({ path: 'qa/l7-e3-cap-' + c + '-on.png' })
    await page.evaluate(() => { window.__capy.state.noLensCap = true })
    await page.waitForTimeout(300)
    out.shots[c + '-off'] = await info()
    await page.screenshot({ path: 'qa/l7-e3-cap-' + c + '-off.png' })
    await page.evaluate(() => { window.__capy.state.noLensCap = false })
  }
  await page.evaluate((o) => fetch('/shot?name=l7-e3-cap.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
