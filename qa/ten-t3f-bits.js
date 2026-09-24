async page => {
  // TEN T3f, the rest of the item, in one visit to Mong Kok:
  //   1. the lens squares up: the animal set down mid-scaffold with no key
  //      held; after 4 s the arcade bearing, the rendered camYaw and the eye.
  //      Then set down on the carriageway: the hint must be gone (NaN).
  //   2. the bakery's lightbox (noHkBakeGlyph): a lens pinned on the arrival
  //      eye and aimed at the sign, the game's own post.render, live against
  //      flagged at the same tick. Luminance inside the sign's projected box
  //      and the brightest pixel outside it (every other light in frame).
  //   3. wowTarget: null on the ground, then ring by ring through a lap
  //      driven by heliDebug, then null again after the eighth.
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
  const out = {}
  const put = (x, y, z) => page.evaluate(({ x, y, z }) => {
    const b = window.__capy.capy.body
    b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    if (b.previousPosition) b.previousPosition.copy(b.position)
    if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position)
    b.aabbNeedsUpdate = true
  }, { x, y, z })
  const read = () => page.evaluate(() => {
    const g = window.__capy, c = g.camera.position, k = g.kowloon
    return { arc: k.arcade(), rideYaw: k.rideYaw(), camYaw: +g.input.camYaw.toFixed(3), p: [g.capy.position.x, g.capy.position.y, g.capy.position.z].map(v => +v.toFixed(2)), cam: [c.x, c.y, c.z].map(v => +v.toFixed(2)), rung: g.state.perfRung }
  })
  // ---- 1. the square-up, and the way out ------------------------------------
  await put(-9.3, 0.6, 0)
  await page.waitForTimeout(600)
  out.squareT0 = await read()
  await page.waitForTimeout(4500)
  out.squareT4 = await read()
  await page.screenshot({ path: 'qa/ten-t3f-bits-square.png' })
  await put(0, 0.6, 0)
  await page.waitForTimeout(800)
  out.road = await read()
  // ---- 2. the lightbox ------------------------------------------------------
  out.sign = await page.evaluate(() => {
    const g = window.__capy, st = g.state, T = g.THREE, cam = g.camera
    const eye = new T.Vector3(6.54, 4.39, 39.09), at = new T.Vector3(-6.3, 5.2, 26)
    const save = { p: cam.position.clone(), q: cam.quaternion.clone() }
    const grab = () => {
      cam.position.copy(eye); cam.lookAt(at); cam.updateMatrixWorld()
      g.post.render()
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { t, d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
    }
    // the sign's box on screen, from its eight corners
    const bx = -10.5 + 1.6 + 2.6, by = 5.2, bz = 26
    cam.position.copy(eye); cam.lookAt(at); cam.updateMatrixWorld()
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1
    for (let i = 0; i < 8; i++) {
      const v = new T.Vector3(bx + (i & 1 ? 0.15 : -0.15), by + (i & 2 ? 1.2 : -1.2), bz + (i & 4 ? 2.3 : -2.3)).project(cam)
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
    }
    const res = {}
    for (const flag of [false, true]) {
      st.noHkBakeGlyph = flag
      for (let i = 0; i < 3; i++) g.tick(1 / 60, false)
      const A = grab()
      const X0 = Math.floor((x0 + 1) / 2 * A.w), X1 = Math.ceil((x1 + 1) / 2 * A.w)
      const Y0 = Math.floor((1 - y1) / 2 * A.h), Y1 = Math.ceil((1 - y0) / 2 * A.h)
      let n = 0, sum = 0, mx = 0, blown = 0, dark = 0, outMx = 0
      const lums = []
      for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        const i = (y * A.w + x) * 4
        const L = 0.2126 * A.d[i] + 0.7152 * A.d[i + 1] + 0.0722 * A.d[i + 2]
        if (x >= X0 && x <= X1 && y >= Y0 && y <= Y1) { n++; sum += L; if (L > mx) mx = L; if (L > 240) blown++; if (L < 90) dark++; lums.push(L) }
        else if (L > outMx) outMx = L
      }
      lums.sort((a, b) => a - b)
      res[flag ? 'flagged' : 'live'] = { box: [X0, Y0, X1, Y1], px: n, mean: +(sum / n).toFixed(1), p95: +lums[Math.floor(lums.length * 0.95)].toFixed(1), max: +mx.toFixed(1), blownShare: +(blown / n).toFixed(3), darkShare: +(dark / n).toFixed(3), outsideMax: +outMx.toFixed(1),
        emissiveIntensity: null, png: A.t.toDataURL('image/png') }
    }
    st.noHkBakeGlyph = false
    for (let i = 0; i < 2; i++) g.tick(1 / 60, false)
    cam.position.copy(save.p); cam.quaternion.copy(save.q)
    return res
  })
  for (const k of ['live', 'flagged']) {
    const b64 = out.sign[k].png.split(',')[1]; delete out.sign[k].png
    await page.evaluate(o => fetch('/shot?name=' + o.name, { method: 'POST', body: o.b64 }), { name: 'ten-t3f-bits-sign-' + k, b64 })
  }
  // ---- 3. wowTarget through a lap -------------------------------------------
  out.wow = []
  out.wow.push({ tag: 'ground', wt: await page.evaluate(() => window.__capy.kowloon.wowTarget()) })
  await page.evaluate(() => { const k = window.__capy.kowloon; const h = k.heliHome(); k.heliDebug({ take: true, x: h.x, y: h.y + 2, z: h.z }) })
  await page.waitForTimeout(500)
  out.wow.push({ tag: 'took', wt: await page.evaluate(() => window.__capy.kowloon.wowTarget()), heli: await page.evaluate(() => { const h = window.__capy.kowloon.heli(); return { on: h.on, run: h.run, ring: h.ring } }), rideYawIsHeli: await page.evaluate(() => { const k = window.__capy.kowloon; return k.rideYaw() === k.heli().yaw && !k.arcade().on }) })
  for (let i = 0; i < 8; i++) {
    await page.evaluate((i) => { const k = window.__capy.kowloon; const r = k.ringAt(i); k.heliDebug({ x: r.x, y: r.y, z: r.z }) }, i)
    await page.waitForTimeout(450)
    out.wow.push({ tag: 'after ring ' + (i + 1), wt: await page.evaluate(() => window.__capy.kowloon.wowTarget()), ring: await page.evaluate(() => window.__capy.kowloon.heli().ring) })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=ten-t3f-bits.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
