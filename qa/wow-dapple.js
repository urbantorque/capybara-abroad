// ROADMAP-WOW G2 — THE DAPPLE. ONE chapter per run (harness rule, 19 Sep:
// every run-code call under four minutes). A fresh boot with pretty pinned
// (trap 31/40), Begin via the button, a real arrival via `hud.cross` (trap 36)
// unless the boot already landed there, a settle plus a camera-still poll.
//
// THE INSTRUMENT: the ground material that carries `userData.grainDapple`
// (grain() writes the baked cell list there), the cell nearest the animal,
// the ground height under it by raycast, and an OWN camera six metres off
// looking at that footprint (the `window.__art` pattern, qa/art-review.js) —
// the play camera would put the crown itself across the frame. Two raw
// renders in ONE evaluate: dappleSet(1), render, grab; dappleSet(0), render,
// grab. The uniform is read at draw time so the second frame is the OFF arm
// with nothing else moved (dt = 0: no wind, no clock).
//
// THE DIFF IS INSIDE THE FOOTPRINT'S SCREEN PROJECTION — each pixel's ray met
// with the ground plane, kept if it lands inside the circle — never a frame
// mean. The CONTROL is the annulus 1.15 r .. 2 r: a dapple that leaks past
// its circle shows up there, and a non-floor number in the control is a bug.
// Both frames land as PNGs to be read by eye, which is the verdict.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // EDIT THIS to the chapter under test. One per run.
  const CHAPTER = 'pantanal'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1500)
  const here = await page.evaluate(() => window.__capy.biome.current)
  if (here !== CHAPTER) {
    await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
    await page.waitForTimeout(9500)
  } else {
    await page.waitForTimeout(3000)
  }
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }

  out.result = await page.evaluate(async (n) => {
    const g = window.__capy, T = g.THREE
    const sh = await import('/src/shared.js')
    // ---- the ground, and its cells ---------------------------------------
    // THE LIVE BIOME'S ground, not the first dappled mesh in the scene: every
    // chapter's world sits in the one scene (capy3-shared-space-leaks), and
    // the first run here read Sydney's lawn while standing in the Pantanal.
    // Visible up the whole parent chain, then the mesh whose nearest cell is
    // nearest the animal.
    const cp = g.capy.position
    function shown(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    let ground = null, cell = null, best = 1e9
    g.scene.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.userData) return
      const cs = o.material.userData.grainDapple
      if (!cs || !cs.length || !o.geometry || o.geometry.attributes.position.count < 2000 || !shown(o)) return
      for (const c of cs) { const d = Math.hypot(c.x - cp.x, c.z - cp.z); if (d < best) { best = d; cell = c; ground = o } }
    })
    if (!ground) {
      const any = []
      g.scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.grainDapple) any.push([o.geometry.attributes.position.count, shown(o)]) })
      return { noGround: true, dappledMeshes: any, biome: g.biome.current }
    }
    const cells = ground.material.userData.grainDapple
    // ---- the lens: six metres off, thirty degrees up, looking at the foot --
    // (under the crown's underside, so the line of sight to the ground does
    // not pass through the canopy). Bearing: from the animal's side. A fig is
    // a 4.6 m circle and the lens looks at its centre; a capoe is a 10 m wood
    // and a lens six metres from its centre is inside it, so for a big cell
    // the target is a point inside the circle on the near side and the lens
    // stays just outside the trunks.
    const a = Math.atan2(cp.x - cell.x, cp.z - cell.z)
    const tIn = cell.r > 6 ? cell.r * 0.45 : 0
    const tx = cell.x + Math.sin(a) * tIn, tz = cell.z + Math.cos(a) * tIn
    // ground height under the target: a ray straight down
    const rc = new T.Raycaster(new T.Vector3(tx, 60, tz), new T.Vector3(0, -1, 0), 0, 120)
    const hits = rc.intersectObject(ground, false)
    const gy = hits.length ? hits[0].point.y : cp.y
    const cam = new T.PerspectiveCamera(40, 1280 / 760, 0.05, 400)
    cam.position.set(tx + Math.sin(a) * 5.2, gy + 3.0, tz + Math.cos(a) * 5.2)
    cam.lookAt(tx, gy, tz); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
    const cv = g.renderer.domElement
    const W = cv.width, H = cv.height
    function grab() {
      const t = document.createElement('canvas'); t.width = W; t.height = H
      const x = t.getContext('2d'); x.drawImage(cv, 0, 0)
      return x.getImageData(0, 0, W, H).data
    }
    async function shoot(tag) {
      await fetch('/shot?name=' + tag, { method: 'POST', body: cv.toDataURL('image/png').split(',')[1] })
    }
    function render() { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam) }
    // ---- ON, OFF, in one turn --------------------------------------------
    sh.dappleSet(1); render(); const A = grab(); const onPng = cv.toDataURL('image/png')
    sh.dappleSet(0); render(); const B = grab(); const offPng = cv.toDataURL('image/png')
    sh.dappleSet(1)
    await fetch('/shot?name=wow-dapple-' + n + '-on', { method: 'POST', body: onPng.split(',')[1] })
    await fetch('/shot?name=wow-dapple-' + n + '-off', { method: 'POST', body: offPng.split(',')[1] })
    // ---- the footprint on screen -----------------------------------------
    // Per pixel: the lens's ray through it, met with the ground plane at gy,
    // gives a world x/z; inside is distance-to-centre under 0.92 r (the mound
    // under a capoe is not quite a plane — the margin keeps the rim honest),
    // the control is the annulus 1.15 r .. 2.0 r. Projecting the circle as a
    // polygon was the first build, and a lens inside a 10 m wood put half its
    // rim behind the camera.
    const org = cam.position.clone(), dir = new T.Vector3()
    function groundXZ(x, y) {
      dir.set((x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 0.5).unproject(cam).sub(org).normalize()
      if (dir.y >= -1e-4) return null
      const t = (gy - org.y) / dir.y
      return [org.x + dir.x * t, org.z + dir.z * t]
    }
    let nIn = 0, mIn = 0, sIn = 0, sInAll = 0, nOut = 0, mOut = 0, sOut = 0
    let darkest = 0
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const p = groundXZ(x, y)
      if (!p) continue
      const dd = Math.hypot(p[0] - cell.x, p[1] - cell.z)
      const isIn = dd < cell.r * 0.92
      const isOut = dd > cell.r * 1.15 && dd < cell.r * 2.0
      if (!isIn && !isOut) continue
      const i = (y * W + x) * 4
      const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3
      if (isIn) { nIn++; sInAll += d; if (d > 2) { mIn++; sIn += d }; if (d > darkest) darkest = d }
      else { nOut++; if (d > 2) { mOut++; sOut += d } }
    }
    const cam0 = g.camera.position
    return {
      biome: g.biome.current, rung: g.state.perfRung, cells: cells.length, cell, gy: +gy.toFixed(2),
      capy: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
      playCam: [+cam0.x.toFixed(1), +cam0.y.toFixed(1), +cam0.z.toFixed(1)],
      groundVerts: ground.geometry.attributes.position.count,
      dapple: sh.dappleInfo(),
      inside: { px: nIn, movedPct: +(100 * mIn / Math.max(nIn, 1)).toFixed(2), meanMoved: +(sIn / Math.max(mIn, 1)).toFixed(2),
                meanAll: +(sInAll / Math.max(nIn, 1)).toFixed(3), maxDelta: +darkest.toFixed(1) },
      control: { px: nOut, movedPct: +(100 * mOut / Math.max(nOut, 1)).toFixed(2), meanMoved: +(sOut / Math.max(mOut, 1)).toFixed(2) },
      calls: g.state.perf && g.state.perf.calls,
    }
  }, CHAPTER)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-dapple.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
