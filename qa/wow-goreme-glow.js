// ROADMAP-WOW Part B, Goreme — THE ENVELOPE'S INNER GLOW WHEN THE BURNER FIRES.
// One chapter, one run. Arrival by the title-card key (`BracketLeft`), a
// settle and a camera-still poll; everything from the REAL arrival lens,
// through the REAL composite (game.post.render(), read in the same turn), so
// the bloom is in the picture.
//
// THE CANDIDATES are every envelope that can glow: the Lambert ones (the
// player's bag, the live field crew — `emissive` = gorBurner, vertex colours,
// radius over 3 m) and the fleet's instances (`gorFleetEnv`/`gorFleetGore`,
// their burn in the `aBurn` attribute, their emitter cut by userData.glowK).
// For each one in the frame, a SILHOUETTE — that mesh (that instance: the
// other 25 zeroed for one render) alone, flat white on black — is the inside
// region; its box grown 30 % is the HALO. A bloom moves the halo; a flat
// colour change cannot.
//
// THE POLL reads the burn every 120 ms for up to 40 s; at the first mid-burn
// (> 0.85) it grabs the composite LIVE, zeroes that envelope's emitter (the
// Lambert's emissiveIntensity, or the fleet's uniform), composites again
// (CUT), restores — nothing else moves — and diffs per region. An OFF frame
// (everything dark) lands first, for the eye, then the live/cut pair.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('BracketLeft') // goreme (13)
  await page.waitForTimeout(9000)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  const out = { errs }
  out.setup = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const sh = await import('/src/shared.js')
    const burner = new T.Color(sh.PALETTE.gorBurner).getHex()
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const cam = g.camera; cam.updateMatrixWorld()
    const flat = new T.MeshBasicMaterial({ color: 0xffffff })
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const clearWas = new T.Color(); g.renderer.getClearColor(clearWas); const clearA = g.renderer.getClearAlpha()
    const sils = window.__glowSil = {}
    const list = window.__glowList = []
    // silhouette of whatever `draw()` renders
    const silhouette = (draw) => {
      g.renderer.setRenderTarget(null); g.renderer.setClearColor(0x000000, 1); g.renderer.clear(); draw()
      ctx.drawImage(g.renderer.domElement, 0, 0)
      const px = ctx.getImageData(0, 0, W, H).data
      let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1
      const sil = new Uint8Array(W * H)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4; if (px[j] > 128) { sil[y * W + x] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
      return { n, box: [x0, y0, x1, y1], sil }
    }
    // 1. the Lambert envelopes
    g.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.material || !o.material.emissive) return
      if (o.material.emissive.getHex() !== burner || !o.material.vertexColors) return
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
      if (o.geometry.boundingSphere.radius < 3) return
      const wasM = o.material; o.material = flat
      const s = silhouette(() => g.renderer.render(o, cam))
      o.material = wasM
      const wp = new T.Vector3(); o.getWorldPosition(wp)
      const id = 'L' + list.length
      o.material.userData.__glowProbe = id
      list.push({ id, kind: 'lambert', box: s.box, silPx: s.n, inFrame: s.n > 200, world: wp.toArray().map(v => +v.toFixed(1)) })
      if (s.n > 200) sils[id] = s.sil
    })
    // 2. the fleet
    let em = null, gm = null
    g.scene.traverse(o => { if (o.name === 'gorFleetEnv') em = o; if (o.name === 'gorFleetGore') gm = o })
    if (em) {
      const M = new T.Matrix4(), Z = new T.Matrix4().makeScale(0, 0, 0), p = new T.Vector3()
      const saved = [], savedG = []
      for (let i = 0; i < em.count; i++) { em.getMatrixAt(i, M); saved.push(M.clone()); if (gm) { gm.getMatrixAt(i, M); savedG.push(M.clone()) } }
      const emM = em.material, gmM = gm ? gm.material : null
      for (let i = 0; i < em.count; i++) {
        p.setFromMatrixPosition(saved[i]).applyMatrix4(em.matrixWorld)
        const wp = p.clone(); p.project(cam)
        if (p.z > 1 || Math.abs(p.x) > 1.3 || Math.abs(p.y) > 1.3) continue
        for (let k = 0; k < em.count; k++) { em.setMatrixAt(k, k === i ? saved[k] : Z); if (gm) gm.setMatrixAt(k, k === i ? savedG[k] : Z) }
        em.instanceMatrix.needsUpdate = true; if (gm) gm.instanceMatrix.needsUpdate = true
        em.material = flat; if (gm) gm.material = flat
        const s = silhouette(() => { g.renderer.render(em, cam); if (gm) { g.renderer.autoClear = false; g.renderer.render(gm, cam); g.renderer.autoClear = true } })
        em.material = emM; if (gm) gm.material = gmM
        const id = 'F' + i
        list.push({ id, kind: 'fleet', i, box: s.box, silPx: s.n, inFrame: s.n > 200, world: wp.toArray().map(v => +v.toFixed(1)) })
        if (s.n > 200) sils[id] = s.sil
      }
      for (let k = 0; k < em.count; k++) { em.setMatrixAt(k, saved[k]); if (gm) gm.setMatrixAt(k, savedG[k]) }
      em.instanceMatrix.needsUpdate = true; if (gm) gm.instanceMatrix.needsUpdate = true
    }
    g.renderer.setClearColor(clearWas, clearA); flat.dispose()
    return { biome: g.biome.current, cam: cam.position.toArray().map(v => +v.toFixed(1)), fleet: !!em, envelopes: list.filter(e => e.inFrame), all: list.length }
  })
  let done = null, offShot = false
  const t0 = Date.now()
  while (Date.now() - t0 < 40000 && !done) {
    const r = await page.evaluate(async (wantOff) => {
      const g = window.__capy
      const mats = {}
      let em = null
      g.scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.__glowProbe) mats[o.material.userData.__glowProbe] = o.material; if (o.name === 'gorFleetEnv') em = o })
      const burnAttr = em ? em.geometry.getAttribute('aBurn') : null
      const list = window.__glowList.filter(e => e.inFrame)
      const level = e => e.kind === 'lambert' ? (mats[e.id] ? mats[e.id].emissiveIntensity / 1.45 : 0) : (burnAttr ? burnAttr.array[e.i] : 0)
      let best = null
      for (const e of list) { const k = level(e); if (!best || k > best.k) best = { e, k } }
      if (!best) return { none: true }
      const allDark = list.every(e => level(e) < 0.05)
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const grab = () => { if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, g.camera); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
      if (wantOff && allDark) {
        grab(); await fetch('/shot?name=wow-goreme-glow-off', { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
        return { off: true }
      }
      if (best.k < 0.85) return { k: +best.k.toFixed(3), who: best.e.id }
      const live = grab(); const liveUrl = g.renderer.domElement.toDataURL('image/png')
      let restore
      if (best.e.kind === 'lambert') { const m = mats[best.e.id], was = m.emissiveIntensity; m.emissiveIntensity = 0; restore = () => { m.emissiveIntensity = was } }
      else { const kk = em.userData.glowK, was = kk.value; kk.value = 0; restore = () => { kk.value = was } }
      const cut = grab(); const cutUrl = g.renderer.domElement.toDataURL('image/png')
      restore()
      const [x0, y0, x1, y1] = best.e.box
      const gw = (x1 - x0) * 0.3, gh = (y1 - y0) * 0.3
      const sil = window.__glowSil[best.e.id]
      const inBox = (x, y, a, b, c, d) => x >= a && x < c && y >= b && y < d
      const st = () => ({ n: 0, moved: 0, sum: 0, max: 0, up: 0 })
      const R = { inside: st(), halo: st(), rest: st() }
      let lr = 0, lg = 0, lb = 0, cr = 0, cg = 0, cb = 0, n = 0
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4
        const d = Math.max(Math.abs(live[j] - cut[j]), Math.abs(live[j + 1] - cut[j + 1]), Math.abs(live[j + 2] - cut[j + 2]))
        const inSil = sil[y * W + x] === 1
        const r = inSil ? R.inside : inBox(x, y, x0 - gw, y0 - gh, x1 + gw, y1 + gh) ? R.halo : R.rest
        r.n++; r.sum += d; if (d > 6) { r.moved++; if ((live[j] + live[j + 1] + live[j + 2]) > (cut[j] + cut[j + 1] + cut[j + 2])) r.up++ } if (d > r.max) r.max = d
        if (inSil) { lr += live[j]; lg += live[j + 1]; lb += live[j + 2]; cr += cut[j]; cg += cut[j + 1]; cb += cut[j + 2]; n++ }
      }
      const fin = r => ({ px: r.n, movedPx: r.moved, movedPct: r.n ? +(100 * r.moved / r.n).toFixed(2) : 0, mean: r.n ? +(r.sum / r.n).toFixed(2) : 0, max: r.max, up: r.up })
      await fetch('/shot?name=wow-goreme-glow-live', { method: 'POST', body: liveUrl })
      await fetch('/shot?name=wow-goreme-glow-cut', { method: 'POST', body: cutUrl })
      return { burn: true, k: +best.k.toFixed(3), envelope: best.e, inside: fin(R.inside), halo: fin(R.halo), rest: fin(R.rest),
               liveRGB: n ? [lr / n, lg / n, lb / n].map(v => Math.round(v)) : null, cutRGB: n ? [cr / n, cg / n, cb / n].map(v => Math.round(v)) : null }
    }, !offShot)
    if (r.none) { done = { none: true }; break }
    if (r.off) offShot = true
    if (r.burn) done = r
    if (!done) await page.waitForTimeout(120)
  }
  out.result = done || { timedOut: true, offShot }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-goreme-glow.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
