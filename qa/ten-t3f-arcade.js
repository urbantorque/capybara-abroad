async page => {
  // THE ARCADE LENS (TEN T3f). Twenty seconds up and down the shopfront under
  // the scaffold with real keys, closed-loop on the camera's own yaw (movement
  // is camera-relative), once with the lens cut (noHkArcadeCam) and once live.
  // About once a second the page is held in one synchronous evaluate and:
  //   - the animal's share of the frame is its world box projected to NDC
  //     (a box, so it over-reads — a conservative number against 15 %);
  //   - the middle third of the screen is an 8 x 8 grid of rays, and a cell is
  //     DITHERED when its first opaque hit lies inside the lens capsule
  //     (shared.js lensCapInfo: eye to chest, radius r) short of the animal —
  //     the same test the rim's discard makes, minus the upward-face and
  //     emissive exemptions it also makes.
  // A PNG per pass at 6 s and 14 s.
  const PORT = 5196
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('kowloon'); await new Promise(r => setTimeout(r, 9000)) })
  await page.evaluate(async () => { window.__t3fShared = await import('/src/shared.js') })
  const out = { passes: [] }
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
  const held = new Set()
  async function setKeys(want) {
    for (const k of keys) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k) }
      if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k) }
    }
  }
  for (const cut of [true, false]) {
    await page.evaluate((cut) => {
      const g = window.__capy
      g.state.noHkArcadeCam = cut
      const b = g.capy.body
      b.position.set(-9.3, 0.6, -8); b.velocity.set(0, 0, 0)
      if (b.previousPosition) b.previousPosition.copy(b.position)
      if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position)
      b.aabbNeedsUpdate = true
    }, cut)
    await page.waitForTimeout(2500)
    const samples = []
    const t0 = Date.now()
    let leg = 0, lastProbe = 0, shots = 0
    const legs = [[-9.3, 8], [-9.3, -8], [-9.3, 8]]
    while (Date.now() - t0 < 20000) {
      const st = await page.evaluate(() => { const g = window.__capy; return { x: g.capy.position.x, z: g.capy.position.z, yaw: g.input.camYaw } })
      const tg = legs[leg % legs.length]
      let dx = tg[0] - st.x, dz = tg[1] - st.z
      const d = Math.hypot(dx, dz)
      if (d < 1.2) { leg++; continue }
      dx /= d; dz /= d
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw)
      const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
      const want = new Set()
      if (iz < -0.38) want.add('KeyW'); if (iz > 0.38) want.add('KeyS')
      if (ix > 0.38) want.add('KeyD'); if (ix < -0.38) want.add('KeyA')
      await setKeys(want)
      const now = Date.now() - t0
      if (now - lastProbe > 900) {
        lastProbe = now
        const s = await page.evaluate(() => {
          const g = window.__capy, T = g.THREE, cam = g.camera
          cam.updateMatrixWorld()
          const capy = g.capy, grp = capy.group
          const box = new T.Box3().setFromObject(grp)
          let x0 = 1, x1 = -1, y0 = 1, y1 = -1
          for (let i = 0; i < 8; i++) {
            const v = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam)
            x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
          }
          const cx0 = Math.max(-1, x0), cx1 = Math.min(1, x1), cy0 = Math.max(-1, y0), cy1 = Math.min(1, y1)
          const share = cx1 > cx0 && cy1 > cy0 ? (cx1 - cx0) * (cy1 - cy0) / 4 : 0
          const ci = window.__t3fShared.lensCapInfo()
          const A = ci.a.clone(), B = ci.b.clone(), R = ci.r
          const AB = B.clone().sub(A), L2 = Math.max(AB.lengthSq(), 1e-4)
          const tMax = Math.max(0.85, 1 - 0.9 / Math.sqrt(L2))
          const isCapy = o => { while (o) { if (o === grp) return true; o = o.parent } return false }
          const rc = new T.Raycaster(); rc.far = Math.sqrt(L2) + 2
          const v2 = new T.Vector2()
          let dith = 0, cells = 0
          const N = 8
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            v2.set(((i + 0.5) / N) * (2 / 3) - 1 / 3, ((j + 0.5) / N) * (2 / 3) - 1 / 3)
            rc.setFromCamera(v2, cam)
            cells++
            let h = null
            for (const x of rc.intersectObjects(g.scene.children, true)) {
              const o = x.object
              if (!o.isMesh || isCapy(o)) continue
              let vis = true, q = o; while (q) { if (!q.visible) { vis = false; break } q = q.parent }
              if (!vis) continue
              const m = Array.isArray(o.material) ? o.material[0] : o.material
              if (!m || m.transparent || m.depthWrite === false) continue
              h = x; break
            }
            if (!h || R <= 0) continue
            const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material
            if (m.isMeshBasicMaterial) continue
            if (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05) continue
            const P = h.point
            const t = P.clone().sub(A).dot(AB) / L2
            if (!(t > 0 && t < tMax)) continue
            const dd = P.distanceTo(A.clone().add(AB.clone().multiplyScalar(t)))
            if (dd > R - 0.1) continue
            if (h.face) {
              const n = h.face.normal.clone().transformDirection(h.object.matrixWorld)
              if (n.y > 0.7 && P.y < B.y) continue
            }
            dith++
          }
          const k = g.kowloon
          return { t: +g.state.time.toFixed(1), p: [capy.position.x, capy.position.y, capy.position.z].map(v => +v.toFixed(2)),
            cam: [cam.position.x, cam.position.y, cam.position.z].map(v => +v.toFixed(2)),
            camYaw: +g.input.camYaw.toFixed(2), arc: k.arcade(), share: +share.toFixed(3), dith, cells,
            capR: R, clear: g.camInfo ? +(g.camInfo.clear || 0).toFixed(2) : null, rung: g.state.perfRung }
        })
        samples.push(s)
      }
      if ((shots === 0 && now > 6000) || (shots === 1 && now > 14000)) {
        await page.screenshot({ path: 'qa/ten-t3f-arcade-' + (cut ? 'cut' : 'live') + '-' + shots + '.png' })
        shots++
      }
      await page.waitForTimeout(120)
    }
    await setKeys(new Set())
    const n = samples.length
    out.passes.push({ cut, n,
      shareMax: Math.max(...samples.map(s => s.share)), shareMean: +(samples.reduce((a, s) => a + s.share, 0) / Math.max(1, n)).toFixed(3),
      over15: samples.filter(s => s.share > 0.15).length,
      dithSamples: samples.filter(s => s.dith > 0).length, dithCellsMax: Math.max(...samples.map(s => s.dith)),
      dithCellsMean: +(samples.reduce((a, s) => a + s.dith, 0) / Math.max(1, n)).toFixed(2),
      arcOn: samples.filter(s => s.arc && s.arc.on).length,
      camYMean: +(samples.reduce((a, s) => a + s.cam[1], 0) / Math.max(1, n)).toFixed(2),
      camXMean: +(samples.reduce((a, s) => a + s.cam[0], 0) / Math.max(1, n)).toFixed(2),
      zSpan: [Math.min(...samples.map(s => s.p[2])), Math.max(...samples.map(s => s.p[2]))],
      samples })
  }
  await page.evaluate(o => fetch('/shot?name=ten-t3f-arcade.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
