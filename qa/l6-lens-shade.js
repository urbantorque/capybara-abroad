async page => {
  // L6 E1 — THE FAR CASCADE. qa/l4r-art-sunaz.js's shadow-on/off diff, restricted
  // to the band y 0.20-0.45 of the frame (the far ground under the walking lens),
  // on a WALKING frame (W held 4 s) in the five daylight chapters the roadmap
  // names. The off arm zeroes shadow.intensity on every shadow-casting
  // directional light (no recompile — three r169 has the uniform) and both arms
  // are grabbed synchronously (harness trap 12). The frame is also written as
  // qa/l6-lens-<chapter>-walk.png to be LOOKED at.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const CH = [['sydney', 'Digit1'], ['venice', 'Digit0'], ['pasto', 'Digit2'], ['sahara', 'Digit8'], ['pantanal', 'Semicolon']]
  const out = { rows: [] }
  for (const [name, key] of CH) {
    await page.goto('http://localhost:5190/')
    await page.waitForTimeout(5500)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3500)
    const row = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const c = g.canvas || g.renderer.domElement
      const suns = []
      g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) suns.push(o) })
      const sun = suns[0]
      const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
      const grab = () => { g.post.render(); return c.toDataURL('image/png') }
      const u1 = grab()
      const keep = suns.map(s => s.shadow.intensity)
      for (const s of suns) s.shadow.intensity = 0
      const u2 = grab()
      suns.forEach((s, i) => { s.shadow.intensity = keep[i] })
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height
      const cx = cv.getContext('2d', { willReadFrequently: true })
      async function dec(url) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = url }); cx.drawImage(im, 0, 0); return cx.getImageData(0, 0, cv.width, cv.height).data }
      const a = await dec(u1), b = await dec(u2)
      const W = cv.width, H = cv.height, y0 = Math.floor(H * 0.20), y1 = Math.floor(H * 0.45)
      let n = 0, hit = 0, sum = 0, nAll = 0, hitAll = 0, nNear = 0, hitNear = 0
      let p50a = [], p50b = []
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4
        const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
        const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]
        const d = lb - la
        nAll++; if (d > 6) hitAll++
        if (y >= y0 && y < y1) { n++; if (d > 6) { hit++; sum += d } }
        if (y >= y1) { nNear++; if (d > 6) hitNear++ }
        if (((y >> 1) & 3) === 0 && ((x >> 1) & 3) === 0) { p50a.push(la); p50b.push(lb) }
      }
      p50a.sort((p, q) => p - q); p50b.sort((p, q) => p - q)
      const p = g.capy.position
      return { biome: g.biome.current, started: g.state.started, rung: g.perfAudit().rung,
        suns: suns.length, sunI: suns.map(s => +s.intensity.toFixed(2)),
        camPitch: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1),
        pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
        bandShadePct: +(100 * hit / n).toFixed(1), bandShadeMean: +(sum / Math.max(1, hit)).toFixed(0),
        nearShadePct: +(100 * hitNear / nNear).toFixed(1), frameShadePct: +(100 * hitAll / nAll).toFixed(1),
        p50on: +p50a[p50a.length >> 1].toFixed(0), p50off: +p50b[p50b.length >> 1].toFixed(0),
        lastError: g.state.lastError || null }
    })
    await page.screenshot({ path: 'qa/l6-lens-' + name + '-walk.png' })
    await page.keyboard.up('KeyW')
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l6-lens-shade.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
