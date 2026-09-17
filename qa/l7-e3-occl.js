async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.addInitScript(() => { window.__l7e3tag = 'after2' })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const TAG = await page.evaluate(() => (window.__l7e3tag || 'run'))
  const NOCAP = /nocap/.test(TAG)
  if (NOCAP) await page.evaluate(() => { window.__capy.state.noLensCap = true })
  const out = { started: null, chapters: {}, tag: TAG, programs: {} }
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
    // the capsule the rim shader opens (L7, E3): eye -> chest, radius; a hit
    // inside it is dithered away on screen, so it is counted separately
    const ci = g.camInfo || {}
    const capA = new T.Vector3().copy(cam.position)
    const chestY = g.capy.group.position.y + 0.45
    const capB = new T.Vector3(g.capy.group.position.x, chestY, g.capy.group.position.z)
    const capR = ci.capR || 0
    const ab = new T.Vector3().subVectors(capB, capA); const abL2 = ab.lengthSq()
    const cEnd = Math.max(0.85, 1 - 0.9 / Math.sqrt(Math.max(abL2, 0.0001)))
    const inCap = (p) => {
      if (!(capR > 0)) return false
      const ap = new T.Vector3().subVectors(p, capA)
      const t = abL2 > 0 ? ap.dot(ab) / abL2 : 0
      if (t >= cEnd || t < 0) return false
      const q = new T.Vector3().copy(capA).addScaledVector(ab, t)
      return q.distanceTo(p) < capR
    }
    // a floor is not an occluder: the shader's own exemption (an upward face
    // below the chest), so a slope under the padded box is not counted as a
    // thing in the way — measured in the first run, 2.3 % "occluded" was
    // palBeach, goreme terrain and the deck of the boat the animal stood on
    const nM3 = new T.Matrix3(), iM4 = new T.Matrix4(), nV = new T.Vector3()
    const isFloor = (h) => {
      if (!h.face || h.point.y >= chestY + 0.3) return false
      nV.copy(h.face.normal)
      if (h.object.isInstancedMesh && h.instanceId !== undefined) { h.object.getMatrixAt(h.instanceId, iM4); nV.applyMatrix3(nM3.getNormalMatrix(iM4)) }
      nV.applyMatrix3(nM3.getNormalMatrix(h.object.matrixWorld)).normalize()
      return nV.y > 0.7
    }
    let n = 0, occ = 0, occSeen = 0, occFloor = 0; const names = {}
    const t0 = performance.now()
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
      if (performance.now() - t0 > 8000) break
      ndc.set(cx - hw + (i + 0.5) / 5 * 2 * hw, cy - hh + (j + 0.5) / 7 * 2 * hh)
      rc.setFromCamera(ndc, cam)
      const hit = rc.intersectObjects(solids, false)
      n++
      if (hit.length) {
        occ++
        // the first hit the capsule does NOT open (and that is not a floor) is what the player sees
        let seen = false, floor = false
        for (let h = 0; h < hit.length; h++) {
          const hm = hit[h].object.material
          const exempt = hm && (hm.transparent || (hm.emissive && hm.emissiveIntensity > 0 && hm.emissive.r + hm.emissive.g + hm.emissive.b > 0.01) || hm.userData && hm.userData.capySelf)
          if (isFloor(hit[h])) { floor = true; continue }
          if (exempt || !inCap(hit[h].point)) { seen = true; break }
        }
        if (seen) occSeen++
        else if (floor) occFloor++
        const o = hit[0].object
        const nm = (o.name || (o.parent && o.parent.name) || o.geometry.type || '?') + (o.isInstancedMesh ? '#i' : '')
        names[nm] = (names[nm] || 0) + 1
      }
    }
    // ---- THE PIXELS (L7, E3): the animal shown and hidden, rendered to a
    // small target and diffed inside its own box. Shadow maps frozen for the
    // pair so the shadow does not count as animal.
    let pxSeen = null, pxBox = null, pxAll = null
    try {
      const W = 320, H = 190
      const r = g.renderer
      const RT = window.__l7rt || (window.__l7rt = new T.WebGLRenderTarget(W, H))
      const pA = window.__l7pa || (window.__l7pa = new Uint8Array(W * H * 4))
      const pB = window.__l7pb || (window.__l7pb = new Uint8Array(W * H * 4))
      const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate
      r.shadowMap.autoUpdate = false
      r.setRenderTarget(RT); r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, pA)
      g.capy.group.visible = false
      r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, pB)
      g.capy.group.visible = true
      r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto
      const bx0 = Math.max(0, Math.floor((x0 + 1) / 2 * W) - 2), bx1 = Math.min(W - 1, Math.ceil((x1 + 1) / 2 * W) + 2)
      const by0 = Math.max(0, Math.floor((y0 + 1) / 2 * H) - 2), by1 = Math.min(H - 1, Math.ceil((y1 + 1) / 2 * H) + 2)
      pxBox = 0; pxAll = 0
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4
        const d = Math.max(Math.abs(pA[k] - pB[k]), Math.abs(pA[k + 1] - pB[k + 1]), Math.abs(pA[k + 2] - pB[k + 2]))
        if (d > 20) { pxAll++; if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) pxBox++ }
      }
      pxSeen = pxBox >= 25
    } catch (e) { pxSeen = 'err:' + String(e).slice(0, 60) }
    const aa = g.capy.animAudit ? g.capy.animAudit() : {}
    return { t: +(performance.now() / 1000).toFixed(1), pitch: +(pitch * 180 / Math.PI).toFixed(1), hz: +hz.toFixed(2), dist: +dist.toFixed(1),
      clear: +(ci.clear || 0).toFixed(2), rest: +(ci.rest || 0).toFixed(2), lens: ci.lens, orbit: ci.orbit === undefined ? null : +ci.orbit.toFixed(2),
      pxH: +((y1 - y0) / 2 * 760).toFixed(0), cy: +((1 - cy) / 2).toFixed(2),
      occ: n ? +(occ / n).toFixed(2) : null, occSeen: n ? +(occSeen / n).toFixed(2) : null, occFloor: n ? +(occFloor / n).toFixed(2) : null, names, rayMs: +(performance.now() - t0).toFixed(0),
      pxSeen, pxBox, pxAll,
      speed: +(aa.speed || 0).toFixed(1), yaw: +(aa.yaw || 0).toFixed(2), err: g.state.lastError ? String(g.state.lastError).slice(0, 80) : null }
  })
  const CH = NOCAP ? ['sydney', 'kowloon', 'venice', 'antarctic', 'cali']
    : ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    }
    const rows = []
    for (let leg = 0; leg < 4; leg++) {
      await page.keyboard.down('KeyW')
      for (let k = 0; k < 6; k++) {
        await page.waitForTimeout(500)
        if (leg === 0 && k === 5) await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-' + c + '-walk.png' })
        rows.push(Object.assign({ leg, ph: 'walk' }, await sample()))
      }
      await page.keyboard.up('KeyW')
      for (let k = 0; k < 5; k++) { await page.waitForTimeout(500); rows.push(Object.assign({ leg, ph: 'stop' }, await sample())) }
      await page.keyboard.down('KeyA'); await page.waitForTimeout(450); await page.keyboard.up('KeyA')
    }
    for (let k = 0; k < 16; k++) { await page.waitForTimeout(750); rows.push(Object.assign({ leg: 9, ph: 'rest' }, await sample())) }
    await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-' + c + '-rest.png' })
    out.chapters[c] = rows
    // no new program: the capsule is a uniform in the rim's one cache key
    out.programs[c] = await page.evaluate(() => window.__capy.renderer.info.programs.length)
    await page.evaluate((o) => fetch('/shot?name=l7-e3-occl-' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  }
}
