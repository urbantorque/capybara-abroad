async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const info = async (tag) => page.evaluate((tag) => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    const fwd = new T.Vector3(); cam.getWorldDirection(fwd)
    const pitch = Math.asin(-fwd.y)
    const hz = 0.5 - Math.tan(pitch) / Math.tan(cam.fov * Math.PI / 360) * 0.5
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const ys = pts.map(p => p.y)
    const ci = g.camInfo || {}
    return { tag, biome: g.biome.current, pitch: +(pitch * 180 / Math.PI).toFixed(1), hz: +hz.toFixed(2), dist: +cam.position.distanceTo(g.capy.group.position).toFixed(1),
      pxH: +((Math.max(...ys) - Math.min(...ys)) / 2 * 760).toFixed(0), cy: +((1 - (Math.max(...ys) + Math.min(...ys)) / 2) / 2).toFixed(2),
      clear: +ci.clear.toFixed(2), rest: +ci.rest.toFixed(2), orbit: ci.orbit, orbits: ci.orbits, capR: ci.capR, swim: +ci.swim.toFixed(2), sub: ci.sub,
      fov: +cam.fov.toFixed(1), err: g.state.lastError ? String(g.state.lastError).slice(0, 200) : null, camSaves: g.state.camSaves || 0 }
  }, tag)
  out.rows.push(await info('sydney-arrive'))
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200)
  await page.screenshot({ path: 'qa/l7-e3-smoke-syd-walk.png' })
  out.rows.push(await info('sydney-walk'))
  await page.keyboard.up('KeyW'); await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l7-e3-smoke-syd-rest.png' })
  out.rows.push(await info('sydney-rest'))
  for (const c of ['venice', 'cali']) {
    await page.evaluate((c) => window.__capy.hud.cross(c), c)
    await page.waitForTimeout(9000)
    out.rows.push(await info(c + '-arrive'))
    for (let leg = 0; leg < 3; leg++) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW')
      await page.waitForTimeout(2500)
      out.rows.push(await info(c + '-stop' + leg))
      await page.screenshot({ path: 'qa/l7-e3-smoke-' + c + '-stop' + leg + '.png' })
      await page.keyboard.down('KeyA'); await page.waitForTimeout(450); await page.keyboard.up('KeyA')
    }
    await page.waitForTimeout(8000)
    out.rows.push(await info(c + '-rest'))
    await page.screenshot({ path: 'qa/l7-e3-smoke-' + c + '-rest.png' })
  }
  await page.evaluate((o) => fetch('/shot?name=l7-e3-smoke.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
