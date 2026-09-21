async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(2000)
  const r = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    let shells = null
    const figLeaf = []
    const leafHex = [0x7fae5a, 0x9cc06a, 0x69a05a]
    g.scene.traverse(o => {
      if (o.isMesh && o.material && o.material.side === T.DoubleSide) {
        const bb = new T.Box3().setFromObject(o)
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2
        if (Math.abs(cx - -0.3) < 1 && Math.abs(cz - -4) < 1) shells = o
      }
      if (o.isInstancedMesh && o.material && o.material.color) {
        const hex = o.material.color.getHex()
        if (leafHex.indexOf(hex) >= 0) figLeaf.push(o)
      }
    })
    if (!shells) return { err: 'no shells mesh found', figLeaf: figLeaf.length }
    const shellVisiblePx = () => {
      g.renderer.setRenderTarget(null)
      shells.visible = false
      g.renderer.render(g.scene, g.camera)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      const a = ctx.getImageData(0, 0, W, H).data
      shells.visible = true
      g.renderer.render(g.scene, g.camera)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      const b = ctx.getImageData(0, 0, W, H).data
      let n = 0
      for (let i = 0; i < a.length; i += 4) {
        const dr = Math.abs(a[i] - b[i]), dgc = Math.abs(a[i+1] - b[i+1]), db = Math.abs(a[i+2] - b[i+2])
        if (dr + dgc + db > 24) n++
      }
      return n
    }
    const results = []
    const deltas = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30]
    for (const d of deltas) {
      g.frameShot({ yaw: 0.35 + d, dist: 8.6, pitch: 0.20, raise: 0.7, hold: 6.0 })
      for (let i = 0; i < 100; i++) g.tick(1/60, false)
      // figs SHOWN (normal) — the occluded reading
      for (const f of figLeaf) f.visible = true
      const withFigs = shellVisiblePx()
      // figs HIDDEN — the unoccluded ceiling
      for (const f of figLeaf) f.visible = false
      const noFigs = shellVisiblePx()
      for (const f of figLeaf) f.visible = true
      results.push({ delta: d, withFigs, noFigs, occludedFrac: +(1 - withFigs / noFigs).toFixed(3) })
    }
    return { W, H, figLeafCount: figLeaf.length, results, capy: g.capy.position }
  })
  await page.evaluate(async (obj) => {
    const b64 = btoa(JSON.stringify(obj, null, 1))
    await fetch('/shot?name=wow3-lens-sydney-check', { method: 'POST', body: b64 })
  }, r)
}
