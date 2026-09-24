async page => {
  // THE BEACH THROWN BACK UP THE WALL (TEN T2d, noRioBounce). Hide-and-diff
  // on the frontage band: the Avenida's merged mesh is found by its bounds,
  // the mask is every pixel that changes when it is hidden, and the mean
  // luminance inside the mask is read with the flag live and cut. Rendered
  // straight to a render target from a PINNED lens (the resting lens is not
  // deterministic), so this is the scene before the composite: the ratio is
  // what the proof slot checks again headful. Three lenses on the sand.
  // Writes qa/ten-t2d-bounce.json.png and ten-t2d-bounce-{on,off}.png.
  const PORT = 5194
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'rio') { g.state.journeyMode = 'free'; g.hud.cross('rio'); await new Promise(r => setTimeout(r, 9000)) } })
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, r = g.renderer, cam = g.camera
    let front = null
    g.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry.attributes.color) return
      const gm = o.geometry; if (!gm.boundingBox) gm.computeBoundingBox()
      const bb = gm.boundingBox
      if (bb.min.z > 5 && bb.max.z < 30 && bb.max.x - bb.min.x > 150 && bb.max.y > 20) front = o
    })
    if (!front) return { err: 'no frontage mesh' }
    const W = 640, H = 380
    const RT = new T.WebGLRenderTarget(W, H)
    const px = { on: new Uint8Array(W * H * 4), off: new Uint8Array(W * H * 4), hid: new Uint8Array(W * H * 4) }
    const lin = v => { v /= 255; return v }                       // the target is linear
    const enc = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    const LENS = [
      { p: [-20, 3.2, -12], t: [-20, 9, 17] },
      { p: [20, 2.6, -8], t: [5, 8, 17] },
      { p: [-45, 4.0, -14], t: [-30, 10, 17] },
    ]
    const rows = []
    const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate
    // the flag's edge is taken in rio's update: let real frames run it, and
    // read the colour array back to be sure it did (a tick can be held)
    const colOf = () => front.geometry.attributes.color.array
    const shoot = async (flag) => {
      g.state.noRioBounce = flag
      for (let w = 0; w < 20; w++) { await new Promise(res => setTimeout(res, 100)); if (out0.sig(flag)) break }
    }
    const sum0 = (() => { let t = 0; const a = colOf(); for (let i = 0; i < a.length; i += 97) t += a[i]; return t })()
    const out0 = { base: null, sig(flag) { let t = 0; const a = colOf(); for (let i = 0; i < a.length; i += 97) t += a[i]; if (this.base === null) this.base = t; return flag ? t < this.hi - 1e-3 : t > this.lo + 1e-3 }, hi: sum0, lo: -1 }
    g.state.noRioBounce = true
    for (let w = 0; w < 30; w++) { await new Promise(res => setTimeout(res, 100)); let t = 0; const a = colOf(); for (let i = 0; i < a.length; i += 97) t += a[i]; if (t < sum0 - 1e-3) { out0.lo = t; break } }
    const swapped = out0.lo > 0
    for (const L of LENS) {
      const pose = () => { cam.position.set(L.p[0], L.p[1], L.p[2]); cam.lookAt(L.t[0], L.t[1], L.t[2]); cam.updateMatrixWorld() }
      const draw = (buf) => { pose(); r.setRenderTarget(RT); r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, buf) }
      r.shadowMap.autoUpdate = false
      await shoot(false); draw(px.on)
      await shoot(true); draw(px.off)
      front.visible = false; draw(px.hid); front.visible = true
      let n = 0, sOn = 0, sOff = 0, eOn = 0, eOff = 0
      for (let i = 0; i < W * H; i++) {
        const k = i * 4
        const d = Math.abs(px.on[k] - px.hid[k]) + Math.abs(px.on[k + 1] - px.hid[k + 1]) + Math.abs(px.on[k + 2] - px.hid[k + 2])
        if (d < 12) continue
        n++
        const yOn = 0.2126 * lin(px.on[k]) + 0.7152 * lin(px.on[k + 1]) + 0.0722 * lin(px.on[k + 2])
        const yOff = 0.2126 * lin(px.off[k]) + 0.7152 * lin(px.off[k + 1]) + 0.0722 * lin(px.off[k + 2])
        sOn += yOn; sOff += yOff; eOn += enc(yOn); eOff += enc(yOff)
      }
      rows.push({ lens: L.p, maskPx: n, maskShare: +(n / (W * H)).toFixed(3),
                  linOn: +(sOn / n).toFixed(4), linOff: +(sOff / n).toFixed(4), linGain: +((sOn / sOff - 1) * 100).toFixed(1),
                  srgbOn: +(eOn / n).toFixed(4), srgbOff: +(eOff / n).toFixed(4), srgbGain: +((eOn / eOff - 1) * 100).toFixed(1) })
    }
    // a picture of the first lens each way, through a 2D canvas (toDataURL
    // on the game canvas is blank; on a 2D one it is not)
    const pics = {}
    for (const [name, flag] of [['on', false], ['off', true]]) {
      const L = LENS[0]
      await shoot(flag)
      cam.position.set(L.p[0], L.p[1], L.p[2]); cam.lookAt(L.t[0], L.t[1], L.t[2]); cam.updateMatrixWorld()
      r.setRenderTarget(RT); r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, px.on)
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H
      const cx = cv.getContext('2d'), im = cx.createImageData(W, H)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4
        for (let c = 0; c < 3; c++) im.data[d + c] = Math.round(255 * enc(px.on[s + c] / 255))
        im.data[d + 3] = 255
      }
      cx.putImageData(im, 0, 0)
      pics[name] = cv.toDataURL('image/png').split(',')[1]
    }
    g.state.noRioBounce = false
    r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto
    RT.dispose()
    return { swapped, rows, pics, rung: g.state.perfRung, err: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null }
  })
  const pics = out.pics || {}
  delete out.pics
  for (const k in pics) await page.evaluate((a) => fetch('/shot?name=ten-t2d-bounce-' + a.k, { method: 'POST', body: a.b }), { k, b: pics[k] })
  await page.evaluate((o) => fetch('/shot?name=ten-t2d-bounce.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  // (a live composite frame is not taken here: setting input.camYaw does not
  // hold the lens inland in rio at arrival; the proof slot takes it headful)
}
