async page => {
  // T4d, noPanSkyFresnel: the sky in the flood while the mirror is parked.
  // Hide-and-diff on the water sheet from pinned lenses, synchronous draws:
  //   r0     rung 0, the planar mirror drawn for THIS camera (game.reflectDraw)
  //   r1     rung 1, mirror parked, the fallback live
  //   r1cut  rung 1, mirror parked, noPanSkyFresnel (the olive sheet)
  //   mask   r1cut with the sheet hidden: the pixels that are water
  // Per lens: % of water pixels changed r1 vs r1cut, % of non-water pixels
  // changed (must be ~0), and the mean colour in the mask for each arm.
  // Hand clock; prefs pf 1 pins the governor so perfRung is ours.
  const NAME = 'ten-t4d-sky'
  const PORT = 5194
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome && window.__capy.biome.current === 'pantanal'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'pantanal') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('pantanal') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.hook = await page.evaluate(() => window.__capy.pantanal.skyFresnel())
  const LENS = {
    river: { cam: [-18, 6.5, -44], look: [-40, 0, -78] },
    bank: { cam: [-34, 3.2, -52], look: [-60, 0.2, -70] },
    play: { cam: [-10, 5.5, -60], look: [-22, 0.2, -72] },
  }
  const arms = [['r0', { perfRung: 0, noPanSkyFresnel: false }, true], ['r1', { perfRung: 1, noPanSkyFresnel: false }, true],
                ['r1cut', { perfRung: 1, noPanSkyFresnel: true }, true], ['mask', { perfRung: 1, noPanSkyFresnel: true }, false]]
  out.lens = {}
  for (const ln of Object.keys(LENS)) {
    const res = {}
    for (const [arm, st, waterOn] of arms) {
      res[arm] = await page.evaluate(async o => {
        const g = window.__capy, THREE = g.THREE, L = o.L
        let water = null
        g.scene.traverse(m => { if (!water && m.isMesh && m.material && m.material.customProgramCacheKey && /\|panSF$/.test(m.material.customProgramCacheKey())) water = m })
        Object.assign(g.state, o.st)
        for (let i = 0; i < 3; i++) g.tick(1 / 60, false)
        Object.assign(g.state, o.st)
        g.tick(1 / 60, false)
        g.renderer.setSize(1280, 760, false)
        g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
        g.camera.position.set(L.cam[0], L.cam[1], L.cam[2])
        g.camera.lookAt(new THREE.Vector3(L.look[0], L.look[1], L.look[2]))
        g.camera.updateMatrixWorld(true)
        // the mirror: drawn for this camera at rung 0, cut to zero at rung 1
        if (o.st.perfRung === 0) { g.reflectDraw(); g.reflectDraw() }
        else { g.state.noReflect = true; g.reflectDraw(); g.state.noReflect = false; g.reflectDraw() }
        const ri = g.reflectInfo()
        if (water) water.visible = o.waterOn
        g.renderer.render(g.scene, g.camera)
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 190
        const cx = cv.getContext('2d'); cx.drawImage(g.renderer.domElement, 0, 0, 320, 190)
        const px = Array.from(cx.getImageData(0, 0, 320, 190).data)
        const d = g.renderer.domElement.toDataURL('image/png')
        if (water) water.visible = true
        await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
        window.__t4dPx = window.__t4dPx || {}
        window.__t4dPx[o.key] = px
        return { found: !!water, refl: { k: +(+ri.k).toFixed(3), on: ri.on, why: ri.why }, sf: g.pantanal.skyFresnel().on }
      }, { L: LENS[ln], st, waterOn, name: NAME + '-' + ln + '-' + arm, key: ln + arm })
    }
    res.diff = await page.evaluate(ln => {
      const P = window.__t4dPx, a = P[ln + 'r1'], b = P[ln + 'r1cut'], m = P[ln + 'mask'], z = P[ln + 'r0']
      const dif = (u, v, i) => Math.max(Math.abs(u[i] - v[i]), Math.abs(u[i + 1] - v[i + 1]), Math.abs(u[i + 2] - v[i + 2]))
      let nW = 0, nD = 0, chW = 0, chD = 0
      const sum = { r0: [0, 0, 0], r1: [0, 0, 0], r1cut: [0, 0, 0] }
      for (let i = 0; i < a.length; i += 4) {
        const isW = dif(b, m, i) > 6
        if (isW) {
          nW++
          if (dif(a, b, i) > 12) chW++
          for (let c = 0; c < 3; c++) { sum.r0[c] += z[i + c]; sum.r1[c] += a[i + c]; sum.r1cut[c] += b[i + c] }
        } else { nD++; if (dif(a, b, i) > 12) chD++ }
      }
      const mean = s => s.map(v => Math.round(v / Math.max(1, nW)))
      return { waterPct: +(nW / (a.length / 4) * 100).toFixed(1), changedInWaterPct: +(chW / Math.max(1, nW) * 100).toFixed(1),
               changedOutsidePct: +(chD / Math.max(1, nD) * 100).toFixed(2),
               meanR0: mean(sum.r0), meanR1: mean(sum.r1), meanR1cut: mean(sum.r1cut) }
    }, ln)
    out.lens[ln] = res
  }
  await page.evaluate(() => { const g = window.__capy; g.state.noPanSkyFresnel = false; g.state.perfRung = 0; g.state.noReflect = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
