async page => {
  // T2e STRETCH PROOF (noSahStallSmoke): the square's joints at a third of the contrast.
  // Resting lens at rung 0 (prefs pf 1), rendered live then cut in one task. The mask is
  // every pixel below row 40% that the flag changed (the joints and nothing else can);
  // the ground is every other pixel in the bottom quarter. Joint contrast = (Lg - Lj) / Lg.
  const CH = 'sahara', NAME = 'ten-t2e-joints'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  page.setDefaultNavigationTimeout(120000)
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5195/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  await page.waitForTimeout(4000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.rung = await page.evaluate(() => window.__capy.state.perfRung)
  out.j = await page.evaluate(() => {
    const g = window.__capy, st = g.state
    const grab = () => {
      // dt 0: the crowd does not step between the two frames (a 1/60 step put 80k px
      // of walking people in the mask); sahUpdateSqJoints does not read dt
      g.tick(0, true)
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { w: t.width, h: t.height, d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data }
    }
    st.noSahStallSmoke = false
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    const A = grab()
    st.noSahStallSmoke = true
    const B = grab()
    st.noSahStallSmoke = false
    const L = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    const W = A.w, H = A.h
    let n = 0, jA = 0, jB = 0, gn = 0, gA = 0, gB = 0
    for (let y = Math.floor(H * 0.4); y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
      if (dd > 18) { n++; jA += L(A.d, i); jB += L(B.d, i) }
      else if (y >= H * 0.75 && dd < 3) { gn++; gA += L(A.d, i); gB += L(B.d, i) }
    }
    const ljA = jA / n, ljB = jB / n, lgA = gA / gn, lgB = gB / gn
    return { maskPx: n, jointLumLive: +ljA.toFixed(4), jointLumCut: +ljB.toFixed(4), groundLumLive: +lgA.toFixed(4), groundLumCut: +lgB.toFixed(4),
      contrastCut: +((lgB - ljB) / lgB).toFixed(4), contrastLive: +((lgA - ljA) / lgA).toFixed(4) }
  })
  await page.screenshot({ path: 'qa/' + NAME + '-live.png' })
  await page.evaluate(() => { window.__capy.state.noSahStallSmoke = true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'qa/' + NAME + '-cut.png' })
  await page.evaluate(() => { window.__capy.state.noSahStallSmoke = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
