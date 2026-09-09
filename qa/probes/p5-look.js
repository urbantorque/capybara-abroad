async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [], shots: [] }

  // toDataURL HAS TO BE IN THE SAME EVALUATE AS THE RENDER. With
  // preserveDrawingBuffer false the buffer is valid until the compositor
  // takes it, and a page.evaluate boundary is long enough to lose it — the
  // first run of this posted a 1280x760 sheet of white.
  const post = async (name, url) => {
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
                        { n: name, u: url })
  }

  // ---- 1. the capybara's own head, close ---------------------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  const r1 = await page.evaluate(async () => {
    const g = window.__capy
    const T = g.THREE
    const p = g.capy.position
    const cam = new T.PerspectiveCamera(38, 1280 / 760, 0.05, 400)
    // three-quarter front, at the animal's own eye height
    // the model's own rotation, not capy.yaw — which is not published
    const my = (g.capy.model || g.capy.group || { rotation: { y: 0 } }).rotation.y
    // the head sits FORWARD of the body origin, so both the camera and the
    // aim point are taken along the model's own facing rather than off p
    const fx = Math.sin(my), fz = Math.cos(my)
    const hx = p.x + fx * 0.52, hz = p.z + fz * 0.52, hy = p.y + 0.26
    const yaw = my + 0.62
    cam.position.set(hx + Math.sin(yaw) * 1.55, hy + 0.20, hz + Math.cos(yaw) * 1.55)
    cam.lookAt(hx, hy, hz)
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam)
    return { url: g.renderer.domElement.toDataURL('image/png'), yaw: Math.round(my * 100) / 100 }
  })
  await post('p5-capy-head', r1.url); delete r1.url
  out.shots.push({ name: 'capy-head', r: r1 })

  // ---- 2. a speech bubble, so the paper can be looked at ------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(6000)
  out.bubble = await page.evaluate(async () => {
    const g = window.__capy
    const L = (g.locals || []).filter(l => l.biome === g.biome.current && l.fig)
    if (!L.length) return { none: true }
    const w = L[0]
    let gy = g.capy.position.y
    try { const a = g[g.biome.current]; if (a && a.terrainHeight) gy = a.terrainHeight(w.x, w.z + 4) + 0.6 } catch (e) {}
    g.capy.body.position.set(w.x, gy, w.z + 4)
    await new Promise(r => setTimeout(r, 2500))
    if (g.say) g.say(w.x, w.z, 'that is an enormous rodent, and it is in my shop')
    await new Promise(r => setTimeout(r, 900))
    const els = Array.from(document.querySelectorAll('div')).filter(e => e.style && e.style.transformOrigin === '50% 100%' && e.style.display !== 'none')
    return { bubbles: els.length, text: els.length ? els[0].textContent : '' }
  })
  await page.screenshot({ path: 'qa/p5-bubble.png' })

  // ---- 3. a whole crowd at playing distance -------------------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  await page.evaluate(async () => {
    const g = window.__capy
    // THE MEAN OF A CROWD IS NOT IN THE CROWD. Sydney's roster is spread
    // round the gardens and its centroid is an empty lawn — the first run of
    // this framed sixty metres of grass. Densest neighbourhood instead.
    let sx = 0, sz = 0, best = -1
    for (const p of g.npcs) {
      if (!p.group) continue
      let c = 0
      for (const q of g.npcs) {
        if (!q.group) continue
        const dx = q.group.position.x - p.group.position.x
        const dz = q.group.position.z - p.group.position.z
        if (dx * dx + dz * dz < 100) c++
      }
      if (c > best) { best = c; sx = p.group.position.x; sz = p.group.position.z }
    }
    let gy = g.capy.position.y
    try { const a = g[g.biome.current]; if (a && a.terrainHeight) gy = a.terrainHeight(sx, sz + 7) + 0.6 } catch (e) {}
    g.capy.body.position.set(sx, gy, sz + 7)
    await new Promise(r => setTimeout(r, 4000))
  })
  out.perf = await page.evaluate(() => {
    const i = window.__capy.renderer.info
    return { calls: i.render.calls, tris: i.render.triangles, prog: i.programs ? i.programs.length : -1,
             geo: i.memory.geometries, tex: i.memory.textures, }
  })
  await page.screenshot({ path: 'qa/p5-crowd.png' })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-look.json', { method: 'POST', body: s })
  }, out)
}
