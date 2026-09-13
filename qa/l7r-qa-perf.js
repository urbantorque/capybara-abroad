async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const errs = []
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)))
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const rows = []
  const pre = await page.evaluate(() => { const g = window.__capy; const pm = performance.memory; return { heap: pm ? pm.usedJSHeapSize : null, programs: g.renderer.info.programs.length, geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, started: g.state.started, ua: navigator.userAgent, gl: (() => { try { const gl = g.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a' } catch (e) { return String(e) } })(), size: [innerWidth, innerHeight, devicePixelRatio] } })
  for (const n of names) {
    // the crossing: rAF gaps for 7 s after hud.cross
    const cross = await page.evaluate(async (name) => {
      const g = window.__capy
      const t0 = performance.now(); const gaps = []; let last = t0, tSwitch = -1
      const p = new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0; if (t - t0 < 7000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      if (g.biome.current !== name) g.hud.cross(name)
      await p
      return { ok: g.biome.current === name, tSwitch: +tSwitch.toFixed(0), maxGap: +Math.max.apply(null, gaps).toFixed(0), over100: gaps.filter(x => x > 100).length, over250: gaps.filter(x => x > 250).length }
    }, n)
    // walking: W held 10 s, gaps, renderer.info per frame, bodies, heap
    await page.keyboard.down('KeyW')
    const walk = await page.evaluate(async (name) => {
      const g = window.__capy
      const pm0 = performance.memory ? performance.memory.usedJSHeapSize : 0
      const t0 = performance.now(); const gaps = []; const stamps = []; let last = t0
      const calls = [], tris = []
      await new Promise(res => { const f = (t) => { gaps.push(t - last); stamps.push(t - t0); last = t; const pf = g.state.perf; if (pf) { calls.push(pf.calls); tris.push(pf.triangles) } if (t - t0 < 10000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      gaps.shift(); stamps.shift()
      // periodic stutter: timestamps of frames over 2x median
      const sorted = gaps.slice().sort((a, b) => a - b)
      const q = (u) => +sorted[Math.min(sorted.length - 1, Math.floor(u * sorted.length))].toFixed(1)
      const med = q(0.5)
      const spikes = []
      for (let i = 0; i < gaps.length; i++) if (gaps[i] > Math.max(2.2 * med, 40)) spikes.push([+stamps[i].toFixed(0), +gaps[i].toFixed(0)])
      const intervals = []
      for (let i = 1; i < spikes.length; i++) intervals.push(spikes[i][0] - spikes[i - 1][0])
      calls.sort((a, b) => a - b); tris.sort((a, b) => a - b)
      const pm1 = performance.memory ? performance.memory.usedJSHeapSize : 0
      let dyn = 0, kin = 0, stat = 0, awake = 0
      for (const b of g.world.bodies) { if (b.type === 1) dyn++; else if (b.type === 4) kin++; else stat++; if (b.sleepState === 0) awake++ }
      let objs = 0, meshes = 0, vis = 0
      g.scene.traverse(o => { objs++; if (o.isMesh) { meshes++; if (o.visible) vis++ } })
      return { biome: g.biome.current, ok: g.biome.current === name, frames: gaps.length, fps: +(1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)).toFixed(1),
        p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +sorted[sorted.length - 1].toFixed(0), over50: gaps.filter(x => x > 50).length, over100: gaps.filter(x => x > 100).length,
        spikes: spikes.slice(0, 12), spikeN: spikes.length, spikeIntervals: intervals.slice(0, 12),
        rung: g.state.perfRung, dpr: g.renderer.getPixelRatio(),
        callsMed: calls[calls.length >> 1], callsMax: calls[calls.length - 1], trisMed: tris[tris.length >> 1], trisMax: tris[tris.length - 1],
        programs: g.renderer.info.programs.length, geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures,
        bodies: g.world.bodies.length, dyn, kin, stat, awake, contacts: g.world.contacts.length,
        objs, meshes, vis, props: g.props.length, locals: (g.locals || []).length,
        heapMB: +(pm1 / 1048576).toFixed(1), heapDeltaMB: +((pm1 - pm0) / 1048576).toFixed(1),
        pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)],
        lastError: g.state.lastError || null }
    }, n)
    await page.keyboard.up('KeyW')
    rows.push(Object.assign({ name: n }, { cross }, walk))
  }
  const post = await page.evaluate(() => { const g = window.__capy; const pm = performance.memory; return { heap: pm ? pm.usedJSHeapSize : null, programs: g.renderer.info.programs.length, geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, time: g.state.time } })
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-perf.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { pre, post, rows, errs: errs.slice(0, 40), errN: errs.length })
}
