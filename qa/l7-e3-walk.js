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
    const ctr = box.getCenter(new T.Vector3())
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const ys = pts.map(p => p.y)
    const ci = g.camInfo || {}
    const aa = g.capy.animAudit ? g.capy.animAudit() : {}
    return { tag, biome: g.biome.current, pitch: +(pitch * 180 / Math.PI).toFixed(1), hz: +hz.toFixed(2), dist: +cam.position.distanceTo(ctr).toFixed(1),
      pxH: +((Math.max(...ys) - Math.min(...ys)) / 2 * 760).toFixed(0), cy: +((1 - (Math.max(...ys) + Math.min(...ys)) / 2) / 2).toFixed(2),
      clear: +ci.clear.toFixed(2), fov: +cam.fov.toFixed(1), speed: +(aa.speed || 0).toFixed(1), swim: !!g.capy.swimming, err: g.state.lastError ? String(g.state.lastError).slice(0, 100) : null }
  }, tag)
  const CH = ['sydney', 'pasto', 'quay', 'cali', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'venice', 'sahara', 'kowloon', 'kyoto', 'rio', 'monaco', 'hanoi']
  for (const c of CH) {
    if (c !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), c); await page.waitForTimeout(9000) }
    else await page.waitForTimeout(2500)
    await page.keyboard.down('KeyW')
    const walk = []
    for (let k = 0; k < 12; k++) { await page.waitForTimeout(500); walk.push(await info('walk')) }
    await page.keyboard.up('KeyW')
    const w6 = walk[5]
    out.rows.push({ biome: c, walk32: w6, cutN: walk.filter(r => r.clear < 0.999).length, n: walk.length, pxMed: walk.map(r => r.pxH).sort((a, b) => a - b)[6], err: walk.find(r => r.err) ? walk.find(r => r.err).err : null })
    await page.waitForTimeout(800)
  }
  await page.evaluate((o) => fetch('/shot?name=l7-e3-walk.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
