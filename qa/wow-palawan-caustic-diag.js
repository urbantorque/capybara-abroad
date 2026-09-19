// Palawan caustic diagnostic: (a) from the ARRIVAL lens, the existing vertex
// net (palCaustics, hidden vs shown) and the grain octave (causticSet 0/1),
// each as a per-pixel diff inside the same shallows mask; (b) the same two
// cuts from an OWN lens 7 m off a patch of bed under ~1 m of water, to tell
// "the term is weak" from "the arrival frame cannot see the bed".
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Equal')
  await page.waitForTimeout(9000)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  const out = { errs }
  out.result = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const sh = await import('/src/shared.js')
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const nets = []; g.scene.traverse(o => { if (o.name === 'palCaustics') nets.push(o) })
    const shoreY = sh.shoreY()
    const ov = new T.ShaderMaterial({ uniforms: { uS: { value: shoreY } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uS; varying vec3 vW; void main(){ float sd = uS - vW.y; gl_FragColor = vec4(clamp(sd / 4.0, 0.0, 1.0), sd < -0.1 ? 1.0 : 0.0, 0.0, 1.0); }' })
    const fogWas = g.scene.fog
    async function suite(cam, tag) {
      const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
      sh.causticSet(1); for (const n of nets) n.visible = true
      const live = grab(); const liveUrl = g.renderer.domElement.toDataURL('image/png')
      sh.causticSet(0); const cutG = grab(); sh.causticSet(1)
      for (const n of nets) n.visible = false; const cutN = grab(); for (const n of nets) n.visible = true
      // mask
      const hid = []; g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && o.material && o.material.transparent && o.material.opacity < 0.98) { hid.push(o); o.visible = false } })
      const pb = g.scene.background; g.scene.overrideMaterial = ov; g.scene.background = new T.Color(0x0000ff)
      const mask = grab(); g.scene.overrideMaterial = null; g.scene.background = pb; for (const o of hid) o.visible = true
      const st = (a, b) => { const r = { n: 0, moved: 0, sum: 0, max: 0 }; for (let i = 0; i < W * H; i++) { const j = i * 4; const sd = mask[j] / 255 * 4, above = mask[j + 1] > 128, bg = mask[j + 2] > 128 && mask[j] < 8; if (bg || above || sd < 0.3 || sd > 2.5) continue; const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2])); r.n++; r.sum += d; if (d > 6) r.moved++; if (d > r.max) r.max = d } return { px: r.n, movedPx: r.moved, movedPct: r.n ? +(100 * r.moved / r.n).toFixed(2) : 0, mean: r.n ? +(r.sum / r.n).toFixed(2) : 0, meanMoved: r.moved ? +(r.sum / r.moved).toFixed(1) : 0, max: r.max } }
      await fetch('/shot?name=wow-palawan-caustic-' + tag, { method: 'POST', body: liveUrl })
      return { grain: st(live, cutG), net: st(live, cutN) }
    }
    const res = { shoreY, nets: nets.length, fog: fogWas ? (fogWas.isFogExp2 ? 'exp2 ' + fogWas.density : 'lin ' + fogWas.near + '..' + fogWas.far) : 'none' }
    res.arrival = await suite(g.camera, 'arrival')
    const cam = new T.PerspectiveCamera(g.camera.fov, W / H, 0.05, 400)
    cam.position.set(4, 3.4, 25); cam.lookAt(4, -1.0, 17.5); cam.updateMatrixWorld()
    res.close = await suite(cam, 'close')
    ov.dispose()
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-palawan-caustic-diag.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
