async page => {
  // T1f STRETCH, noWireFade — the spawn frame through ONE frozen copy of the camera, raw render
  // (no composite), live then flagged. Per-pixel: how much of the frame is cable in each, and
  // the two pictures written through the sink. Rung pinned to 0 (pretty).
  const NAME = 'ten-t1f-wires-ab'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === 'cali') break
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cali') }); await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const grab = () => {
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      return { c: c2, d: ctx.getImageData(0, 0, W, H).data }
    }
    const wait = ms => new Promise(r => setTimeout(r, ms))
    g.state.noWireFade = false; await wait(300)
    const live = grab(), live2 = grab()
    const liveDbg = g.cali.chivaDebug()
    g.state.noWireFade = true; await wait(300)
    const off = grab()
    g.state.noWireFade = false
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 12) n++ } return n }
    const post = async (name, c) => fetch('/shot?name=' + name, { method: 'POST', body: c.toDataURL('image/png').split(',')[1] })
    await post('ten-t1f-wires-ab-live', live.c); await post('ten-t1f-wires-ab-off', off.c)
    return { W, H, noiseFloorPx: diff(live.d, live2.d), liveVsOffPx: diff(live.d, off.d), pct: +(100 * diff(live.d, off.d) / (W * H)).toFixed(2),
             faded: liveDbg.wireFaded, rung: g.state.perfRung, err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
