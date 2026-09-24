async page => {
  // T4e: WHAT DRAWS THE HATCHING ON THE KARST. The reviewer's two frames:
  // the animal at the surface at the base of the island's front wall
  // (-6, 0.2, -24) and at (-21, 0.4, -30), the lens behind it looking at the
  // wall (camYaw so the wall is ahead) and the lens with the wall behind it
  // (so the boom is pushed into the rock). Per frame the world clock is
  // FROZEN and one frame is taken per arm with one term cut: the capsule
  // (noLensCap), AO (noAO), the smooth shadow filter (noShadowLerp), form
  // shade (noFormShade), the island's shadow reception (receiveShadow off).
  // The cliff mask is hide-and-diff palIsland; in it, the high-frequency
  // energy (mean |Laplacian| of luma) and the share of pixels whose 4x4
  // neighbourhood holds an ordered-dither hole (a pixel 40+ darker or lighter
  // than both horizontal neighbours). Hatching is energy; stipple is holes.
  const NAME = 'ten-t4e-karst'
  const PORT = 5195
  const out = { shots: {} }
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('palawan') })
  let t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    const ok = await page.evaluate(() => { const g = window.__capy; return g.biome.current === 'palawan' && !!g.palawan && g.capy.position.z > 20 })
    if (ok) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(6000)
  const measure = (b64a, b64h) => page.evaluate(async o => {
    const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
    const A = await load(o.a), Hh = await load(o.h), W = 1280, H = 760
    const Y = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) Y[i] = 0.2126 * A[i * 4] + 0.7152 * A[i * 4 + 1] + 0.0722 * A[i * 4 + 2]
    let n = 0, lap = 0, holes = 0
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (x < 300 && y < 240) continue
      if (x > 1060 && y > 540) continue
      const i = y * W + x, p = i * 4
      if (Math.abs(A[p] - Hh[p]) + Math.abs(A[p + 1] - Hh[p + 1]) + Math.abs(A[p + 2] - Hh[p + 2]) < 30) continue
      n++
      lap += Math.abs(4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - W] - Y[i + W])
      const dl = Y[i] - Y[i - 1], dr = Y[i] - Y[i + 1]
      if ((dl > 40 && dr > 40) || (dl < -40 && dr < -40)) holes++
    }
    return { maskPx: n, lap: n ? +(lap / n).toFixed(2) : null, holesPerK: n ? +(holes / n * 1000).toFixed(2) : null }
  }, { a: b64a, h: b64h })
  const spots = [{ key: 'wallAhead', x: -6, z: -24, yaw: Math.PI }, { key: 'wallBehind', x: -6, z: -24, yaw: 0 },
                 { key: 'west', x: -21, z: -28, yaw: Math.PI * 0.75 }]
  // 'open' puts the capsule back on the island (noPalKarstSolid, the T4e cut);
  // it runs before noLensCap because the capsule's radius is damped and does
  // not come back under a frozen clock once it has been cut.
  const arms = [['base', {}], ['open', { noPalKarstSolid: true }], ['noLensCap', { noLensCap: true }], ['noAO', { noAO: true }], ['noShadowLerp', { noShadowLerp: true }],
                ['noFormShade', { noFormShade: true }], ['noRecv', { recv: false }]]
  for (const s of spots) {
    const S = out.shots[s.key] = {}
    await page.evaluate(o => {
      const g = window.__capy, b = g.capy.body
      if (window.__t4eStep) { g.time.step = window.__t4eStep; window.__t4eStep = null }
      b.position.set(o.x, 0.3, o.z); b.velocity.set(0, 0, 0)
      if (g.input) g.input.camYaw = o.yaw
    }, s)
    await page.waitForTimeout(5000)
    S.at = await page.evaluate(() => { const g = window.__capy, c = g.camera.position, p = g.capy.position; return { cam: c.toArray().map(v => +v.toFixed(2)), capy: p.toArray().map(v => +v.toFixed(2)), rung: g.state.perfRung } })
    await page.evaluate(() => { const g = window.__capy; window.__t4eStep = g.time.step; g.time.step = () => 0 })
    await page.waitForTimeout(500)
    for (const [nm, f] of arms) {
      await page.evaluate(o => {
        const g = window.__capy, st = g.state
        st.noPalKarstSolid = !!o.noPalKarstSolid
        st.noLensCap = !!o.noLensCap; st.noAO = !!o.noAO; st.noShadowLerp = !!o.noShadowLerp; st.noFormShade = !!o.noFormShade
        const isl = g.scene.getObjectByName('palIsland'); isl.receiveShadow = o.recv !== false
        if (isl.material) isl.material.needsUpdate = true
      }, f)
      await page.waitForTimeout(700)
      const a = (await page.screenshot({ path: 'qa/' + NAME + '-' + s.key + '-' + nm + '.png' })).toString('base64')
      await page.evaluate(() => { window.__capy.scene.getObjectByName('palIsland').visible = false })
      await page.waitForTimeout(400)
      const h = (await page.screenshot()).toString('base64')
      await page.evaluate(() => { window.__capy.scene.getObjectByName('palIsland').visible = true })
      S[nm] = await measure(a, h)
    }
    await page.evaluate(() => { const g = window.__capy, st = g.state; st.noLensCap = st.noAO = st.noShadowLerp = st.noFormShade = false; const isl = g.scene.getObjectByName('palIsland'); isl.receiveShadow = true; isl.material.needsUpdate = true })
  }
  await page.evaluate(() => { const g = window.__capy; if (window.__t4eStep) g.time.step = window.__t4eStep })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
