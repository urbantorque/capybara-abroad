async page => {
  // THE FRAME, MEASURED THREE WAYS (the perf review, 13 Sep 2026). Per chapter, at rung 0 (the
  // 'pretty' setting pins it): (1) the walking frame under rAF — p50/p95 of the gap and the main
  // thread's own bill by module (game.state.perf.ms); (2) the CPU alone — sixty ticks with no draw;
  // (3) the GPU+CPU cost of a draw, twenty back to back with gl.finish(), min of five — full, and
  // with one thing off at a time: the composite, the shadow pass, 0.6 of the pixels.
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const names = ['sydney', 'quay', 'venice', 'kowloon', 'hanoi', 'cave', 'pantanal', 'goreme', 'iceland', 'rio']
  const out = { env: await page.evaluate(() => { const g = window.__capy, r = g.renderer, s = r.getDrawingBufferSize(new g.THREE.Vector2()); const gl = r.getContext(); const dbg = gl.getExtension('WEBGL_debug_renderer_info'); return { dpr: r.getPixelRatio(), buf: [s.x, s.y], win: [innerWidth, innerHeight], gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, perf: g.perfAudit() } }), rows: [] }
  for (const n of names) {
    await page.evaluate((name) => window.__capy.hud.cross(name), n)
    await page.waitForTimeout(6000)
    await page.keyboard.down('KeyW')
    const walk = await page.evaluate(async () => {
      const g = window.__capy
      const t0 = performance.now(); const gaps = []; let last = t0
      await new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      gaps.shift(); const sorted = gaps.slice().sort((a, b) => a - b)
      const q = (u) => +sorted[Math.min(sorted.length - 1, Math.floor(u * sorted.length))].toFixed(1)
      const ms = {}; for (const k in g.state.perf.ms) ms[k] = +g.state.perf.ms[k].toFixed(2)
      let cpu = 0; for (const k in ms) cpu += ms[k]
      return { p50: q(0.5), p95: q(0.95), max: +sorted[sorted.length - 1].toFixed(0), frames: gaps.length, ms, cpu: +cpu.toFixed(1), rung: g.state.perfRung, calls: g.state.perf.calls, tris: g.state.perf.triangles, programs: g.state.perf.programs, contacts: g.state.perf.contacts }
    })
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(500)
    const cost = await page.evaluate(() => {
      const g = window.__capy, r = g.renderer, gl = r.getContext()
      // CPU alone: sixty ticks, no draw
      let t0 = performance.now(); for (let i = 0; i < 60; i++) g.tick(1 / 60, false); const cpuTick = +((performance.now() - t0) / 60).toFixed(2)
      const draw = () => g.post.render()
      const timed = (fn, reps) => { let best = Infinity; for (let k = 0; k < reps; k++) { fn(); gl.finish(); const t = performance.now(); for (let i = 0; i < 20; i++) fn(); gl.finish(); const per = (performance.now() - t) / 20; if (per < best) best = per } return +best.toFixed(2) }
      const full = timed(draw, 5)
      const noPost = timed(() => { r.setRenderTarget(null); r.render(g.scene, g.camera) }, 5)
      const was = r.shadowMap.enabled; r.shadowMap.enabled = false
      const noShadow = timed(draw, 5)
      r.shadowMap.enabled = was
      const pr = r.getPixelRatio(); r.setPixelRatio(pr * 0.6); r.setSize(innerWidth, innerHeight)
      const dpr06 = timed(draw, 5)
      r.setPixelRatio(pr); r.setSize(innerWidth, innerHeight)
      // shadow casters and lights, for the record
      let casters = 0, lights = 0, meshes = 0, inst = 0
      g.scene.traverseVisible(o => { if (o.isLight) lights++; if (o.isMesh || o.isInstancedMesh) { meshes++; if (o.castShadow) casters++; if (o.isInstancedMesh) inst++ } })
      return { cpuTick, full, noPost, noShadow, dpr06, casters, lights, meshes, inst, farMs: g.state.farMs ? +g.state.farMs.toFixed(2) : null }
    })
    out.rows.push(Object.assign({ biome: n }, walk, cost))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7-perf.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
