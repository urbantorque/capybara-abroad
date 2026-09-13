async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, chapters: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const sample = async () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const fwd = new T.Vector3(); cam.getWorldDirection(fwd)
    const pitch = Math.asin(-fwd.y)
    const hz = 0.5 - Math.tan(pitch) / Math.tan(cam.fov * Math.PI / 360) * 0.5
    const box = new T.Box3().setFromObject(g.capy.group)
    const ctr = box.getCenter(new T.Vector3())
    const dist = cam.position.distanceTo(ctr)
    // rays through a 5x7 grid over the animal's projected box (x1.3)
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 * 1.3, hh = (y1 - y0) / 2 * 1.3
    const solids = []
    const skip = new Set(); g.capy.group.traverse(o => skip.add(o))
    const walk = (o) => { if (!o.visible) return; if ((o.isMesh || o.isInstancedMesh) && !skip.has(o) && !(o.name && /sky|dome|cloud|sun/i.test(o.name))) solids.push(o); for (const c of o.children) walk(c) }
    walk(g.scene)
    const rc = new T.Raycaster(); rc.far = dist * 0.9
    const ndc = new T.Vector2()
    let n = 0, occ = 0; const names = {}
    const t0 = performance.now()
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
      if (performance.now() - t0 > 8000) break
      ndc.set(cx - hw + (i + 0.5) / 5 * 2 * hw, cy - hh + (j + 0.5) / 7 * 2 * hh)
      rc.setFromCamera(ndc, cam)
      const hit = rc.intersectObjects(solids, false)
      n++
      if (hit.length) {
        occ++
        const o = hit[0].object
        const nm = (o.name || (o.parent && o.parent.name) || o.geometry.type || '?') + (o.isInstancedMesh ? '#i' : '')
        names[nm] = (names[nm] || 0) + 1
      }
    }
    const ci = g.camInfo || {}
    const aa = g.capy.animAudit ? g.capy.animAudit() : {}
    return { t: +(performance.now() / 1000).toFixed(1), pitch: +(pitch * 180 / Math.PI).toFixed(1), hz: +hz.toFixed(2), dist: +dist.toFixed(1),
      clear: +(ci.clear || 0).toFixed(2), rest: +(ci.rest || 0).toFixed(2), lens: ci.lens, lensBias: ci.lensBias,
      pxH: +((y1 - y0) / 2 * 760).toFixed(0), occ: n ? +(occ / n).toFixed(2) : null, names, rayMs: +(performance.now() - t0).toFixed(0),
      speed: +(aa.speed || 0).toFixed(1), yaw: +(aa.yaw || 0).toFixed(2), headX: +(aa.headX || 0).toFixed(2), mood: aa.mood, blink: aa.blink, nap: aa.nap }
  })
  const CH = ['sydney', 'kowloon', 'venice', 'antarctic', 'cali']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    }
    const rows = []
    // 4 legs: walk 3 s, stop 2.5 s, turn 0.5 s
    for (let leg = 0; leg < 4; leg++) {
      await page.keyboard.down('KeyW')
      for (let k = 0; k < 6; k++) { await page.waitForTimeout(500); rows.push(Object.assign({ leg, ph: 'walk' }, await sample())) }
      await page.keyboard.up('KeyW')
      for (let k = 0; k < 5; k++) { await page.waitForTimeout(500); rows.push(Object.assign({ leg, ph: 'stop' }, await sample())) }
      await page.keyboard.down('KeyA'); await page.waitForTimeout(450); await page.keyboard.up('KeyA')
    }
    // then a long rest: 12 s, sample every 750 ms
    for (let k = 0; k < 16; k++) { await page.waitForTimeout(750); rows.push(Object.assign({ leg: 9, ph: 'rest' }, await sample())) }
    await page.screenshot({ path: 'qa/l7r-art-occl2-' + c + '.png' })
    out.chapters[c] = rows
  }
  await page.evaluate((o) => fetch('/shot?name=l7r-art-occl2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
