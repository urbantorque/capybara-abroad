async page => {
  // q1-walk: real keys, real clock. Walk the animal at a thing that used to
  // be walk-through and report where it stopped. Steering is camera-relative
  // and camYaw drifts, so the key set is recomputed every 80 ms from
  // game.input.camYaw and the vector to the target (headless-qa-harness).
  await page.reload()
  await page.waitForTimeout(4500)
  // A digit key only travels from the title card, and the controls only run
  // once the game is started: Digit1 starts it, and switchTo does the rest.
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { rows: [] }

  async function goTo(biome, x, z, yAbs) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a.biome) g.biome.switchTo(a.biome)
      const api = g[a.biome]
      const y = a.yAbs !== undefined ? a.yAbs : api.terrainHeight(a.x, a.z) + 0.6
      const b = g.capy.body
      b.position.set(a.x, y, a.z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, { biome, x, z, yAbs })
    await page.waitForTimeout(1200)
  }
  async function walkAt(tx, tz, secs) {
    const keys = { w: false, a: false, s: false, d: false }
    const t0 = Date.now()
    let closest = 1e9
    while (Date.now() - t0 < secs * 1000) {
      const st = await page.evaluate((a) => {
        const g = window.__capy, p = g.capy.body.position
        const dx = a.tx - p.x, dz = a.tz - p.z
        const d = Math.hypot(dx, dz)
        // world bearing of the target against the camera's forward: W is
        // input.z = -1, which capybara.js turns into (-sin yaw, -cos yaw), a
        // bearing of yaw + pi. D is (cos yaw, -sin yaw) = yaw - pi/2.
        const want = Math.atan2(dx, dz)
        const yaw = g.input.camYaw || 0
        let rel = want - yaw - Math.PI
        while (rel > Math.PI) rel -= Math.PI * 2
        while (rel < -Math.PI) rel += Math.PI * 2
        return { x: p.x, y: p.y, z: p.z, d, rel, yaw, want }
      }, { tx, tz })
      closest = Math.min(closest, st.d)
      // pick the key set whose direction is nearest to rel (0 = forward)
      const c = Math.cos(st.rel), s = Math.sin(st.rel)
      const want = { w: c > 0.38, s: c < -0.38, a: s > 0.38, d: s < -0.38 }
      for (const k of ['w', 'a', 's', 'd']) {
        if (want[k] && !keys[k]) { await page.keyboard.down(('Key' + k.toUpperCase())); keys[k] = true }
        if (!want[k] && keys[k]) { await page.keyboard.up(('Key' + k.toUpperCase())); keys[k] = false }
      }
      await page.waitForTimeout(80)
    }
    for (const k of ['w', 'a', 's', 'd']) if (keys[k]) await page.keyboard.up(('Key' + k.toUpperCase()))
    const end = await page.evaluate(() => { const p = window.__capy.capy.body.position; return [Math.round(p.x*100)/100, Math.round(p.y*100)/100, Math.round(p.z*100)/100] })
    return { end, closest: Math.round(closest * 100) / 100 }
  }

  // 1. Cali: the south-bank parapet at z = -14.0 (centre), 0.5 m thick, from
  //    the lawn at z = -22 walking north. x = 60 is clear of the bridge and the Ermita (x 30 is the church).
  //    ...FROM THE WALKWAY, walking out. From the lawn the embankment's own
  //    box stops you first, so the test would pass without the parapet. On
  //    the walkway (top 0.74) the parapet at z -14 (0.75..1.75) is the only
  //    thing between the animal and the drop to the lawn.
  await goTo('cali', 60, -11, 0.74 + 0.5)
  {
    const r = await walkAt(60, -22, 4)
    const parapetFace = -14.0 + 0.25
    out.rows.push({ what: 'cali parapet (south bank), from the walkway', target: [60, -22],
                    face_z: parapetFace, stopped_at: r.end, closest: r.closest,
                    stopped_before_face: r.end[2] > parapetFace,
                    through: r.end[2] < -14.5 })
  }
  // 2. Cali: the biggest ceiba in the valley — found off the instanced trunk
  //    mesh (46 instances, scale 1.3 wide are the ceibas).
  const ceiba = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    // an approach from -x that meets nothing but the tree: no static AABB
    // within 1.2 m of the line from 6 m out to 1.6 m out
    const boxes = []
    for (const b of g.world.bodies) { if (b.mass > 0) continue; b.updateAABB(); const lo = b.aabb.lowerBound, hi = b.aabb.upperBound; if (lo.x === lo.x && (hi.x - lo.x) < 300) boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z]) }
    const clear = (x, z, y) => { for (const b of boxes) { if (b[4] < y - 0.2 || b[1] > y + 1.2) continue; if (b[3] < x - 6.5 || b[0] > x - 1.4 || b[5] < z - 1.2 || b[2] > z + 1.2) continue; return false } return true }
    let best = null
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || o.count !== 46) return
      let vis = true
      for (let p = o; p; p = p.parent) if (!p.visible) vis = false
      if (!vis) return
      const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3()
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.decompose(P, Q, S)
        if (S.x > 1.2 && P.x > -60 && P.x < 60 && P.z > -60 && P.z < 60 && clear(P.x, P.z, P.y - S.y * 0.45)) {
          const cand = { x: P.x, z: P.z, r: S.x, h: S.y }
          if (!best || Math.hypot(P.x, P.z) < Math.hypot(best.x, best.z)) best = cand
        }
      }
    })
    return best
  })
  if (ceiba) {
    const ax = ceiba.x - 6, az = ceiba.z
    await goTo('cali', ax, az)
    const r = await walkAt(ceiba.x, ceiba.z, 4)
    const dEnd = Math.hypot(r.end[0] - ceiba.x, r.end[2] - ceiba.z)
    out.rows.push({ what: 'cali ceiba trunk', tree: ceiba, stopped_at: r.end,
                    dist_to_centre: Math.round(dEnd * 100) / 100, closest: r.closest,
                    through: r.closest < 0.7 })
  } else out.rows.push({ what: 'cali ceiba trunk', error: 'no ceiba found' })
  // 3. Kyoto: a sugi on the hill. Same trick: the 360-count trunk mesh.
  await goTo('kyoto', 0, 0)
  const sugi = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    const boxes = []
    for (const b of g.world.bodies) { if (b.mass > 0) continue; b.updateAABB(); const lo = b.aabb.lowerBound, hi = b.aabb.upperBound; if (lo.x === lo.x && (hi.x - lo.x) < 300) boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z]) }
    const clear = (x, z, y) => { for (const b of boxes) { if (b[4] < y - 0.2 || b[1] > y + 1.2) continue; if (b[3] < x - 5.5 || b[0] > x - 1.4 || b[5] < z - 1.2 || b[2] > z + 1.2) continue; return false } return true }
    let best = null
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || o.count !== 360) return
      const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3()
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.decompose(P, Q, S)
        if (S.x < 0.01) continue
        if (!clear(P.x, P.z, P.y - S.y * 0.5)) continue
        if (g.kyoto.terrainHeight(P.x - 5, P.z) < g.kyoto.terrainHeight(P.x, P.z) - 2.5) continue   // not up a cliff
        const cand = { x: P.x, z: P.z, r: S.x, h: S.y }
        // nearest to the summit, which is where the walk is
        const d = Math.hypot(P.x + 34, P.z + 128)
        if (d > 20 && d < 60 && (!best || d < best.d)) { cand.d = d; best = cand }
      }
    })
    return best
  })
  if (sugi) {
    await goTo('kyoto', sugi.x - 5, sugi.z)
    const r = await walkAt(sugi.x, sugi.z, 4)
    const dEnd = Math.hypot(r.end[0] - sugi.x, r.end[2] - sugi.z)
    out.rows.push({ what: 'kyoto sugi trunk', tree: sugi, stopped_at: r.end,
                    dist_to_centre: Math.round(dEnd * 100) / 100, closest: r.closest,
                    through: r.closest < 0.35 })
  } else out.rows.push({ what: 'kyoto sugi trunk', error: 'no sugi found' })
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=q1walk.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
