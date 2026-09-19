// ROADMAP-WOW Part B, Palawan — CAUSTICS ON THE SAND UNDER THE SHALLOWS.
// One chapter, one run (harness rule: under four minutes). Arrival by the
// title-card key at boot (`Equal`), a settle, a camera-still poll; then ONE
// evaluate from the REAL arrival lens (a beat is in the arrival frame or it
// is not a beat):
//   1. live: causticSet(1), raw render, grab;  cut: causticSet(0), render,
//      grab — nothing ticks between, so the diff is the term and nothing else.
//   2. THE MASK, from geometry not colour: the scene re-rendered under an
//      override material that writes metres-below-the-waterline into red
//      (sd / 4, so 0..4 m) and "above the line" into green; the sea sheet
//      itself (a transparent plane AT the waterline) is discarded so the bed
//      shows through. Shallows = sd in [0.3, 2.5] (where the term is gated
//      on), dry = sd < -0.1 (the control: it must read ~0), deep = sd > 2.8.
//   3. per-pixel diff inside each region; never a frame mean. Live and an
//      amplified diff land as PNGs to be read by eye (rippling light on the
//      bed, nothing on dry sand, no lattice).
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Equal') // palawan (12)
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
    const cam = g.camera
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    // 1. live and cut, same instant
    sh.causticSet(1); const live = grab(); const liveUrl = g.renderer.domElement.toDataURL('image/png')
    sh.causticSet(0); const cut = grab()
    sh.causticSet(1)
    // 2. the mask
    const shoreY = sh.shoreY()
    const ov = new T.ShaderMaterial({
      uniforms: { uS: { value: shoreY } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uS; varying vec3 vW; void main(){ float sd = uS - vW.y; gl_FragColor = vec4(clamp(sd / 4.0, 0.0, 1.0), sd < -0.1 ? 1.0 : 0.0, 0.0, 1.0); }'
    })
    const prevOv = g.scene.overrideMaterial, prevBg = g.scene.background
    // the sea sheet (and every other transparent thing) is hidden for the mask
    // pass, so the bed shows through; restored after.
    const hid = []
    g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && o.material && o.material.transparent && o.material.opacity < 0.98) { hid.push(o); o.visible = false } })
    g.scene.overrideMaterial = ov; g.scene.background = new T.Color(0x0000ff)
    const mask = grab(); const maskUrl = g.renderer.domElement.toDataURL('image/png')
    g.scene.overrideMaterial = prevOv; g.scene.background = prevBg
    for (const o of hid) o.visible = true
    ov.dispose()
    // 3. the diff per region
    const reg = { shallows: { n: 0, moved: 0, sum: 0, up: 0, down: 0 }, dry: { n: 0, moved: 0, sum: 0, up: 0, down: 0 }, deep: { n: 0, moved: 0, sum: 0, up: 0, down: 0 }, sky: { n: 0, moved: 0, sum: 0, up: 0, down: 0 } }
    const dimg = ctx.createImageData(W, H)
    let maxD = 0
    for (let i = 0; i < W * H; i++) {
      const j = i * 4
      const sd = mask[j] / 255 * 4, above = mask[j + 1] > 128, bg = mask[j + 2] > 128 && mask[j] < 8
      const r = bg ? reg.sky : above ? reg.dry : (sd >= 0.3 && sd <= 2.5) ? reg.shallows : (sd > 2.8 ? reg.deep : null)
      const dl = (live[j] + live[j + 1] + live[j + 2]) - (cut[j] + cut[j + 1] + cut[j + 2])
      const d = Math.max(Math.abs(live[j] - cut[j]), Math.abs(live[j + 1] - cut[j + 1]), Math.abs(live[j + 2] - cut[j + 2]))
      if (d > maxD) maxD = d
      if (r) { r.n++; r.sum += d; if (d > 6) { r.moved++; if (dl > 0) r.up++; else r.down++ } }
      dimg.data[j] = Math.min(255, d * 4); dimg.data[j + 1] = r === reg.shallows ? 60 : 0; dimg.data[j + 2] = r === reg.dry ? 60 : 0; dimg.data[j + 3] = 255
    }
    const fin = (r) => ({ px: r.n, pct: r.n ? +(100 * r.n / (W * H)).toFixed(1) : 0, movedPx: r.moved, movedPct: r.n ? +(100 * r.moved / r.n).toFixed(2) : 0, mean: r.n ? +(r.sum / r.n).toFixed(3) : 0, meanMoved: r.moved ? +(r.sum / r.moved).toFixed(1) : 0, up: r.up, down: r.down })
    ctx.putImageData(dimg, 0, 0)
    const diffUrl = c2.toDataURL('image/png')
    await fetch('/shot?name=wow-palawan-caustic-live', { method: 'POST', body: liveUrl })
    await fetch('/shot?name=wow-palawan-caustic-diff', { method: 'POST', body: diffUrl })
    await fetch('/shot?name=wow-palawan-caustic-mask', { method: 'POST', body: maskUrl })
    return { biome: g.biome.current, shoreY, hidden: hid.length, maxDiff: maxD, cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
             shallows: fin(reg.shallows), dry: fin(reg.dry), deep: fin(reg.deep), sky: fin(reg.sky), caustic: sh.causticInfo(), noCaustic: !!g.state.noCaustic }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-palawan-caustic.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
