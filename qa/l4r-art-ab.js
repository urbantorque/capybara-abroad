async page => {
  // L4 art review — light-rig A/B. For four daylight chapters and one night,
  // the settled frame under: the rig as shipped; the sun's cast shadow off;
  // the key raised (sky/ambient/fill × 0.45, sun × 1.12 — the 3-stop outdoors);
  // and the raw scene with no composite. Synchronous grabs (shadow-probe.js's
  // trap: an await between two renders ticks the world).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const CH = [['Digit1', 'sydney'], ['Digit2', 'pasto'], ['Digit0', 'venice'], ['Equal', 'palawan'], ['Period', 'monaco']]
  const out = { rows: [], errs }
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = await page.evaluate(async (name) => {
      const g = window.__capy, T = g.THREE
      const c = g.canvas || g.renderer.domElement
      const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
      const fill = g.scene.children.find(o => o.isDirectionalLight && !o.castShadow)
      const hemi = g.scene.children.find(o => o.isHemisphereLight)
      const amb = g.scene.children.find(o => o.isAmbientLight)
      const post = async (arm, url) => fetch('/shot?name=l4r-art-' + name + '-' + arm, { method: 'POST', body: url })
      const grab = () => { g.post.render(); return c.toDataURL('image/png') }
      const rig = { sun: +sun.intensity.toFixed(2), sunCol: '#' + sun.color.getHexString(), hemi: +hemi.intensity.toFixed(2), amb: +(amb ? amb.intensity : 0).toFixed(2), fill: +(fill ? fill.intensity : 0).toFixed(2), sunDir: sun.position.clone().sub(sun.target.position).normalize().toArray().map(v => +v.toFixed(2)), shadowHalf: sun.shadow.camera.right, mapSize: sun.shadow.mapSize.x, shadowType: g.renderer.shadowMap.type, camPitchDeg: +(THREE_ANGLE()).toFixed(1) }
      function THREE_ANGLE() { const d = new T.Vector3(); g.camera.getWorldDirection(d); return Math.asin(-d.y) * 180 / Math.PI }
      const urls = {}
      urls.base = grab()
      sun.castShadow = false; urls.noshadow = grab(); sun.castShadow = true
      const k = { s: sun.intensity, h: hemi.intensity, a: amb ? amb.intensity : 0, f: fill ? fill.intensity : 0 }
      sun.intensity = k.s * 1.12; hemi.intensity = k.h * 0.45; if (amb) amb.intensity = k.a * 0.45; if (fill) fill.intensity = k.f * 0.45
      urls.key = grab()
      sun.intensity = k.s; hemi.intensity = k.h; if (amb) amb.intensity = k.a; if (fill) fill.intensity = k.f
      try {
        g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera); urls.nopost = c.toDataURL('image/png')
      } catch (e) { rig.nopostErr = String(e) }
      for (const a in urls) await post(a, urls[a])
      return Object.assign({ name }, rig)
    }, name)
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4r-art-ab.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
