async page => {
  // Is the mirror pass pixel-bound or object-bound? The drained pass at
  // four target scales, and with the dome hidden, and with every
  // instanced mesh hidden. Minimum of five reps each (the machine is
  // shared; the minimum is the honest number under contention).
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__capy.hud.cross('kyoto'))
  await page.waitForTimeout(11000)
  await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(26, 0.3, 19.5); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(26, 0.3, 19.5) })
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const gl = g.renderer.getContext()
    const px = new Uint8Array(4)
    const drain = () => { g.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) }
    const timePass = () => {
      const a = []
      for (let rep = 0; rep < 5; rep++) {
        drain(); const t0 = performance.now()
        for (let k = 0; k < 20; k++) g.reflectDraw()
        drain(); a.push((performance.now() - t0) / 20)
      }
      return +Math.min(...a).toFixed(2)
    }
    const timeMain = () => {
      const a = []
      for (let rep = 0; rep < 5; rep++) {
        drain(); const t0 = performance.now()
        for (let k = 0; k < 20; k++) g.post.render()
        drain(); a.push((performance.now() - t0) / 20)
      }
      return +Math.min(...a).toFixed(2)
    }
    const out = {}
    g.state.noReflect = false
    for (const sc of [1.0, 0.5, 0.35, 0.25]) { g.state.reflectScale = sc; g.reflectDraw(); out['scale' + sc] = timePass() }
    g.state.reflectScale = 0.5
    out.mainPass = timeMain()
    g.state.noReflect = true; g.reflectDraw(); out.mainPassNoReflectTex = timeMain(); g.state.noReflect = false
    // the dome hidden
    const sky = g.scene.children.find(o => o.renderOrder === -20)
    if (sky) { sky.visible = false; out.noDome = timePass(); sky.visible = true }
    // every instanced mesh hidden
    const inst = []; g.scene.traverse(o => { if (o.isInstancedMesh && o.visible) inst.push(o) })
    inst.forEach(o => { o.visible = false }); out.noInstanced = timePass(); inst.forEach(o => { o.visible = true })
    // only the capybara + dome (everything else hidden): the floor of renderer.render itself
    const roots = g.scene.children.filter(o => o.visible && o !== sky && !(g.capy && (o === g.capy.group || o === g.capy.model)))
    roots.forEach(o => { o.visible = false }); out.emptyScene = timePass(); roots.forEach(o => { o.visible = true })
    out.instN = inst.length
    delete g.state.reflectScale
    return out
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-reflect-perf2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, r)
}
