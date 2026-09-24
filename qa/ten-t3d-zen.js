async page => {
  // T3d, the raked gravel: a lens pinned over the dry garden (the walk-in lens, 7 m off the
  // south wall's gap and 5 m up), drawn through the composite. The number is read on a
  // strip of bare raked bed seen through the gap (x 600-680, y 470-630 at 1280 x 760, no
  // rock, no wall): the share of it that is a stripe (luminance under 92 % of the strip's
  // median) and how deep the stripes are (their mean against the median).
  // No flag: the rake is a width and a PALETTE shade, a change to a term, not a new term.
  const CH = 'kyoto', NAME = 'ten-t3d-zen'
  const out = {}
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'kyoto'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:5194/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === CH) break
      await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
      await page.waitForTimeout(11000)
    }
  }
  out.shot = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE, K = g.kyoto
    g.tick(1 / 60, false)
    g.camera.position.set(-34, K.terrainHeight(-34, 26) + 5, 26)
    g.camera.lookAt(new THREE.Vector3(-34, K.terrainHeight(-34, 8), 6))
    g.camera.updateMatrixWorld(true)
    g.post.render()
    const c = g.renderer.domElement, t = document.createElement('canvas')
    t.width = c.width; t.height = c.height
    t.getContext('2d').drawImage(c, 0, 0)
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data
    // the bed between the rocks: x -46..-22, z 0..16, projected; sample its screen box
    const pr = (x, z) => { const v = new THREE.Vector3(x, K.terrainHeight(x, z) + 0.2, z).project(g.camera); return [(v.x + 1) * 0.5 * t.width, (1 - v.y) * 0.5 * t.height] }
    const a = pr(-44, 16), b = pr(-24, 16), e = pr(-34, 1)
    const x0 = Math.max(0, Math.round(Math.min(a[0], b[0]))), x1 = Math.min(t.width, Math.round(Math.max(a[0], b[0]))), y0 = Math.round(e[1]), y1 = Math.round(a[1])
    const L = []
    for (let y = 470; y < 630; y++) for (let x = 600; x < 680; x++) { const i = (y * t.width + x) * 4; L.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) }
    const S = L.slice().sort((p, q) => p - q), med = S[S.length >> 1]
    const st = L.filter(v => v < med * 0.92), ml = st.reduce((s, v) => s + v, 0) / Math.max(1, st.length)
    await fetch('/shot?name=ten-t3d-zen' + (window.__t3dTag || ''), { method: 'POST', body: c.toDataURL('image/png').split(',')[1] })
    return { bedBox: [x0, y0, x1, y1], median: +med.toFixed(3), stripeShare: +(st.length / L.length).toFixed(3), stripeLum: +ml.toFixed(3), stripeDepth: +(1 - ml / med).toFixed(3) }
  })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
