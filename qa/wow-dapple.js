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
// THE DIFF IS INSIDE THE FOOTPRINT'S SCREEN PROJECTION — the circle at ground
// height projected as a 48-gon, even-odd test per pixel — never a frame mean.
// The CONTROL is the annulus from r to 2 r: a dapple that leaks past its
// circle shows up there, and a non-floor number in the control is a bug.
// Both frames land as PNGs to be read by eye, which is the verdict.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // EDIT THIS to the chapter under test. One per run.
  const CHAPTER = 'sydney'
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
    let ground = null
    g.scene.traverse(o => {
      if (ground || !o.isMesh || !o.material || !o.material.userData) return
      const c = o.material.userData.grainDapple
      if (c && c.length && o.geometry && o.geometry.attributes.position.count > 2000) ground = o
    })
    if (!ground) {
      const any = []
      g.scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.grainDapple) any.push(o.geometry.attributes.position.count) })
      return { noGround: true, dappledMeshes: any, biome: g.biome.current }
    }
    const cells = ground.material.userData.grainDapple
    const cp = g.capy.position
    let cell = cells[0], best = 1e9
    for (const c of cells) { const d = Math.hypot(c.x - cp.x, c.z - cp.z); if (d < best) { best = d; cell = c } }
    // ground height under the cell centre: a ray straight down
    const rc = new T.Raycaster(new T.Vector3(cell.x, 60, cell.z), new T.Vector3(0, -1, 0), 0, 120)
    const hits = rc.intersectObject(ground, false)
    const gy = hits.length ? hits[0].point.y : cp.y
    // ---- the lens: six metres off, thirty degrees up, looking at the foot --
    // (under the crown's underside, so the line of sight to the ground does
    // not pass through the canopy). Bearing: from the animal's side.
    const a = Math.atan2(cp.x - cell.x, cp.z - cell.z)
    const cam = new T.PerspectiveCamera(40, 1280 / 760, 0.05, 400)
    cam.position.set(cell.x + Math.sin(a) * 5.2, gy + 3.0, cell.z + Math.cos(a) * 5.2)
    cam.lookAt(cell.x, gy, cell.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
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
    function poly(r, ox, oz) {
      const pts = []
      for (let i = 0; i < 48; i++) {
        const t = i / 48 * Math.PI * 2
        const v = new T.Vector3(cell.x + (ox || 0) + Math.cos(t) * r, gy + 0.02, cell.z + (oz || 0) + Math.sin(t) * r).project(cam)
        pts.push([(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H])
      }
      return pts
    }
    function inside(pts, x, y) {
      let c = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c
      }
      return c
    }
    // THE CONTROL: a disc of ground the same size, just past the footprint on
    // the far side from the lens (1.8 r along the view, so every point of it
    // is in front of the camera — a circle round the cell at 2 r would put its
    // near rim behind the lens and the projection would be garbage).
    const pIn = poly(cell.r), pOut = poly(cell.r * 0.7, -Math.sin(a) * cell.r * 1.8, -Math.cos(a) * cell.r * 1.8)
    let nIn = 0, mIn = 0, sIn = 0, sInAll = 0, nOut = 0, mOut = 0, sOut = 0
    let darkest = 0
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const isIn = inside(pIn, x, y)
      const isOut = !isIn && inside(pOut, x, y)
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
