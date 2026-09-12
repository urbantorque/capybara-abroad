async page => {
  // L4 art review — where the sun sits relative to the resting lens, in all
  // nineteen chapters, and how much of the GROUND half of the frame the cast
  // shadow actually reaches. Two synchronous grabs (shadow on / off) per
  // chapter, diffed in-page. `rel` is the bearing of the sun from the camera's
  // forward: 0 = sun dead ahead (backlit; shadows fall toward the lens),
  // 180 = sun behind the lens (front-lit; shadows hide behind their casters).
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty' (a1): the perf governor under load is not the picture
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const c = g.canvas || g.renderer.domElement
      const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
      const hemi = g.scene.children.find(o => o.isHemisphereLight)
      const amb = g.scene.children.find(o => o.isAmbientLight)
      const fill = g.scene.children.find(o => o.isDirectionalLight && !o.castShadow)
      const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
      const sd = sun.position.clone().sub(sun.target.position).normalize()
      const camYaw = Math.atan2(fwd.x, fwd.z), sunYaw = Math.atan2(sd.x, sd.z)
      let rel = (sunYaw - camYaw) * 180 / Math.PI; rel = ((rel + 540) % 360) - 180
      const elev = Math.asin(sd.y) * 180 / Math.PI
      const grab = () => { g.post.render(); return c.toDataURL('image/png') }
      const u1 = grab(); sun.castShadow = false; const u2 = grab(); sun.castShadow = true
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height
      const cx = cv.getContext('2d', { willReadFrequently: true })
      async function dec(url) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = url }); cx.drawImage(im, 0, 0); return cx.getImageData(0, 0, cv.width, cv.height).data }
      const a = await dec(u1), b = await dec(u2)
      const W = cv.width, H = cv.height, y0 = Math.floor(H * 0.45)
      let n = 0, hit = 0, sum = 0, nAll = 0, hitAll = 0
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4
        const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
        const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]
        const d = lb - la
        nAll++; if (d > 6) hitAll++
        if (y >= y0) { n++; if (d > 6) { hit++; sum += d } }
      }
      const hz = 0.5 - Math.tan(Math.asin(-fwd.y)) / Math.tan(g.camera.fov * Math.PI / 360) * 0.5
      return { biome: g.biome.current, camPitch: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1), horizonFromTop: +hz.toFixed(2), fov: g.camera.fov,
        sunElev: +elev.toFixed(0), sunRel: +rel.toFixed(0), sun: +sun.intensity.toFixed(2), hemi: +hemi.intensity.toFixed(2), amb: +(amb ? amb.intensity : 0).toFixed(2), fill: +(fill ? fill.intensity : 0).toFixed(2),
        groundShadePct: +(100 * hit / n).toFixed(1), groundShadeMean: +(sum / Math.max(1, hit)).toFixed(0), frameShadePct: +(100 * hitAll / nAll).toFixed(1) }
    })
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4r-art-sunaz.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
