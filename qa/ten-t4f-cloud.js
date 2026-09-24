async page => {
  // T4f, the cloud is soft (noCloudSoft). Fresh free file, perf pinned to
  // 'pretty' (rung 0), real clock. Cross into the Drift, drop the animal into
  // open cloud from 14 m and take the landing as the player gets it; then pin
  // the body and the yaw and take the same frame live and with the flag set,
  // with an edge-energy number read off each PNG in the page (mean |dL| to the
  // right and down neighbour, 0-255, over the lower 45% of the frame outside
  // the animal's box). Last, the rung-1 park: the low wisps must go and the
  // soft lobes must stay. Fresh session after any drift.js edit.
  const NAME = 'ten-t4f-cloud'
  const PORT = 5196
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  out.started = await page.evaluate(() => !!window.__capy.state.started)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('drift') })
  let t0 = Date.now(), arrived = false
  while (Date.now() - t0 < 45000) {
    arrived = await page.evaluate(() => {
      const g = window.__capy
      if (g.biome.current !== 'drift' || !g.drift) return false
      const s = g.drift.SPAWN, p = g.capy.position
      return Math.hypot(p.x - s.x, p.z - s.z) < 5
    })
    if (arrived) break
    await page.waitForTimeout(200)
  }
  out.arrived = arrived
  await page.waitForTimeout(2500)
  // open cloud: no island within 16 m, 30-80 m from the spawn
  out.P = await page.evaluate(() => {
    const d = window.__capy.drift, s = d.SPAWN
    const clear = (x, z) => { for (let a = 0; a < 16; a++) for (const r of [0, 8, 16]) { const h = d.terrainHeight(x + Math.cos(a * 0.3927) * r, z + Math.sin(a * 0.3927) * r); if (h > d.waterLevel + 0.01) return false } return true }
    for (let r = 30; r <= 80; r += 5) for (let a = 0; a < 24; a++) {
      const x = s.x + Math.cos(a * 0.2618) * r, z = s.z + Math.sin(a * 0.2618) * r
      if (clear(x, z)) return { x: +x.toFixed(1), z: +z.toFixed(1) }
    }
    return null
  })
  const edge = async (buf) => page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const W = c.width, H = c.height, d = x.getImageData(0, 0, W, H).data
    const L = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    let s = 0, n = 0, hard = 0
    for (let y = Math.floor(H * 0.55); y < H - 2; y++) for (let xx = 330; xx < W - 230; xx++) {
      if (xx > W * 0.40 && xx < W * 0.60 && y > H * 0.70) continue
      const i = (y * W + xx) * 4, l = L(i)
      const g = Math.abs(l - L(i + 4)) + Math.abs(l - L(i + W * 4))
      s += g; n++; if (g > 8) hard++
    }
    return { mean: +(s / n).toFixed(3), hardPct: +(100 * hard / n).toFixed(2) }
  }, buf.toString('base64'))
  const read = () => page.evaluate(() => {
    const g = window.__capy, c = g.camera.position, p = g.capy.position, cs = g.drift.cloudSoft()
    let near = 0, nearest = 1e9
    for (const w of cs.low) { const d = Math.hypot(w[0] - c.x, w[1] - c.y, w[2] - c.z); if (d < 25) near++; if (d < nearest) nearest = d }
    return { cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], capy: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
             rung: g.state.perfRung, flat: cs.flat, soft: cs.soft, top: cs.top, lowOn: cs.lowOn, bankSoft: cs.bankSoft, bankTris: cs.bankTris,
             tris: cs.tris, trisFlat: cs.trisFlat, lowNearCam25: near, lowNearest: +nearest.toFixed(1),
             calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles }
  })
  // ---- the landing, as it happens
  await page.evaluate(P => {
    const g = window.__capy, b = g.capy.body
    b.position.set(P.x, 14, P.z); b.velocity.set(0, -2, 0); b.aabbNeedsUpdate = true
  }, out.P)
  t0 = Date.now()
  while (Date.now() - t0 < 8000) {
    const y = await page.evaluate(() => window.__capy.capy.position.y)
    if (y < 0.6) break
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(450)
  out.land = await read()
  await page.screenshot({ path: 'qa/' + NAME + '-land.png' })
  // ---- pinned A/B
  await page.evaluate(P => {
    const g = window.__capy
    if (window.__pin) clearInterval(window.__pin)
    const y = g.capy.body.position.y
    window.__pin = setInterval(() => {
      const b = g.capy.body
      b.position.set(P.x, y, P.z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      if (g.input) g.input.camYaw = 0.6
    }, 16)
  }, out.P)
  await page.waitForTimeout(3500)
  out.on = await read()
  let buf = await page.screenshot({ path: 'qa/' + NAME + '-on.png' })
  out.on.edge = await edge(buf)
  await page.evaluate(() => { window.__capy.state.noCloudSoft = true })
  await page.waitForTimeout(700)
  out.off = await read()
  buf = await page.screenshot({ path: 'qa/' + NAME + '-off.png' })
  out.off.edge = await edge(buf)
  await page.evaluate(() => { window.__capy.state.noCloudSoft = false })
  await page.waitForTimeout(700)
  out.on2 = await read()
  buf = await page.screenshot({ path: 'qa/' + NAME + '-on2.png' })
  out.on2.edge = await edge(buf)
  // ---- the rung-1 park (the governor may write it back; read at once)
  out.r1 = await page.evaluate(() => new Promise(r => {
    const g = window.__capy, was = g.state.perfRung
    g.state.perfRung = 1
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const cs = g.drift.cloudSoft(); const o = { soft: cs.soft, top: cs.top, flat: cs.flat, lowOn: cs.lowOn, bankSoft: cs.bankSoft, rung: g.state.perfRung }
      g.state.perfRung = was; r(o)
    }))
  }))
  await page.evaluate(() => { if (window.__pin) clearInterval(window.__pin) })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
