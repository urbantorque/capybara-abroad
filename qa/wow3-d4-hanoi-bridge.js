async page => {
  // ROADMAP-WOW2 V3 — THE FAR PLANE FROM SOMEWHERE ELSE. Two of the twelve
  // far layers are not in their chapter's arrival frame and never could be:
  // Kowloon's Lion Rock is up a street whose resting frame contains no sky at
  // all (the depth sweep's sky share there is 0.000, measured twice — at rest
  // and turned 126° up the street), and Hanoi's far spans are out along a
  // bridge 53° off the lake lens. A layer nobody can see is not built, so
  // each is measured from where the chapter actually puts the player: the
  // helicopter's ceiling over Mong Kok (the chapter's own marquee, 110 m),
  // and the animal walked out onto the dyke at the foot of Long Biên.
  //
  // Same two renders as qa/wow2-far-depth.js — far group shown and hidden
  // through ONE camera inside one evaluate — plus a screenshot, from a
  // camera this script places (qa/wow-sheet.js's own `__art.cam` pattern,
  // the raw scene render, no composite) or from the live lens after the
  // animal has been moved. Output: qa/wow2-far-from-<tag>.json + PNG.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = 'hanoi'
  const TAG = 'hanoi-bridge-d4'
  // { cam: [x, y, z], at: [x, y, z], fov } — a placed camera; or
  // { put: [x, z] } — move the animal there and use the live resting lens.
  const FROM = { cam: [44, 9, 215], at: [44, 6, 520], fov: 48 }
  const out = { errs, chapter: CHAPTER, tag: TAG, from: FROM }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  const here = await page.evaluate(() => window.__capy.biome.current)
  if (here !== CHAPTER) {
    await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
    await page.waitForFunction((n) => window.__capy.biome.current === n, CHAPTER, { timeout: 60000, polling: 500 })
    await page.waitForTimeout(6000)
  } else {
    await page.waitForTimeout(4000)
  }
  if (FROM.put) {
    await page.evaluate((p) => {
      const g = window.__capy
      const y = g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight
        ? g[g.biome.current].terrainHeight(p[0], p[1]) : 1.4
      g.capy.body.position.set(p[0], y + 1.2, p[1])
      g.capy.body.velocity.setZero()
    }, FROM.put)
    await page.waitForTimeout(4000)
    for (let tries = 0; tries < 10; tries++) {
      const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      await page.waitForTimeout(900)
      const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
    }
  }

  out.result = await page.evaluate(async (FROM) => {
    const g = window.__capy, T = g.THREE
    let cam
    if (FROM.cam) {
      cam = new T.PerspectiveCamera(FROM.fov || 48, 1280 / 760, 0.5, g.camera.far)
      cam.position.set(FROM.cam[0], FROM.cam[1], FROM.cam[2])
      cam.lookAt(FROM.at[0], FROM.at[1], FROM.at[2])
      cam.updateMatrixWorld()
    } else {
      cam = g.camera.clone(); cam.updateMatrixWorld()
    }
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const grp = g.far && g.far.group
    if (!grp) return { noFar: true }
    grp.visible = true; const on = grab()
    grp.visible = false; const off = grab()
    grp.visible = true
    let n = 0, sum = 0, x0 = W, x1 = 0, y0 = H, y1 = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4
      const dd = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
      if (dd > 8) { n++; sum += dd; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    // and leave the placed camera in place for the screenshot below, by
    // rendering it once more (the next composite frame overwrites it, so the
    // shot is taken from the live lens when FROM.put and from the raw render
    // when FROM.cam — which is why the raw one is returned as a data URL).
    grab()
    const shot = FROM.cam ? g.renderer.domElement.toDataURL('image/png') : null
    const cp = g.capy.position
    return { diff: { px: n, pct: +(100 * n / (W * H)).toFixed(2), meanDelta: n ? +(sum / n).toFixed(1) : 0, bbox: n ? [x0, y0, x1, y1] : null },
             far: g.far.audit(), shot, capy: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
             camPos: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)] }
  }, FROM)
  if (out.result && out.result.shot) {
    // the raw render goes through the /shot sink as a PNG, because
    // page.screenshot would capture the NEXT composite frame instead
    await page.evaluate(async (o) => {
      await fetch('/shot?name=wow2-far-from-' + o.tag + '.png', { method: 'POST', body: o.result.shot.split(',')[1] })
    }, out)
    out.result.shot = '(sent)'
  } else {
    await page.screenshot({ path: 'qa/wow2-far-from-' + TAG + '.png' })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-far-from-' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
