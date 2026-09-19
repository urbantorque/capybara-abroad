async page => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('BracketLeft')
  await page.waitForTimeout(9000)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  const r = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const dir = new T.Vector3(); cam.getWorldDirection(dir)
    const out = { cam: cam.position.toArray().map(v => +v.toFixed(1)), dir: dir.toArray().map(v => +v.toFixed(2)), fov: cam.fov, capy: g.capy.position.toArray().map(v => +v.toFixed(1)), hits: [] }
    const rc = new T.Raycaster()
    for (const [sx, sy] of [[720, 80], [720, 160], [640, 60], [800, 120]]) {
      rc.setFromCamera(new T.Vector2(sx / 1280 * 2 - 1, 1 - sy / 760 * 2), cam)
      const hs = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible)
      const h = hs[0]
      if (!h) { out.hits.push({ sx, sy, none: true }); continue }
      const chain = []; for (let o = h.object; o; o = o.parent) chain.push((o.name || o.type) + (o.isInstancedMesh ? '[inst ' + h.instanceId + ']' : ''))
      const wp = new T.Vector3(); h.object.getWorldPosition(wp)
      out.hits.push({ sx, sy, d: +h.distance.toFixed(1), chain: chain.slice(0, 4), at: wp.toArray().map(v => +v.toFixed(1)), emis: h.object.material && h.object.material.emissive ? h.object.material.emissive.getHexString() + ' k' + h.object.material.emissiveIntensity.toFixed(2) : null, mat: h.object.material && h.object.material.type })
    }
    return out
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=rv-gor-what.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, r)
}
