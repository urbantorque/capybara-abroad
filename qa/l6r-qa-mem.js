async page => {
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const pre = await page.evaluate(() => {
    const g = window.__capy
    if (!g || !g.state.started) return { started: false }
    // geometry attribution hook (harness trap 28): count first renders vs creations
    if (!g.__l6geo) {
      g.__l6geo = { created: 0 }
      const T = g.THREE || null
      try {
        const P = Object.getPrototypeOf(g.capy.mesh ? g.capy.mesh.geometry : g.scene.children.find(o => o.geometry).geometry)
        const orig = P.computeBoundingSphere
        P.computeBoundingSphere = function () { g.__l6geo.created++; return orig.apply(this, arguments) }
      } catch (e) { g.__l6geo.err = String(e) }
    }
    let objs = 0, meshes = 0
    g.scene.traverse(o => { objs++; if (o.isMesh) meshes++ })
    const pm = performance.memory
    return { started: true, biome: g.biome.current, mem: JSON.parse(JSON.stringify(g.renderer.info.memory)),
      programs: g.renderer.info.programs.length, bodies: g.world.bodies.length, objs, meshes,
      heap: pm ? pm.usedJSHeapSize : null, props: g.props.length, locals: (g.locals || []).length,
      time: +g.state.time.toFixed(0) }
  })
  const laps = []
  for (let lap = 0; lap < 2; lap++) {
    const rows = []
    for (const n of names) {
      const r = await page.evaluate(async (name) => {
        const g = window.__capy
        const t0 = performance.now()
        const gaps = []
        let last = t0, tSwitch = -1
        const p = new Promise(res => {
          const f = (t) => {
            const gap = t - last; last = t; gaps.push(gap)
            if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0
            if (t - t0 < 7000) requestAnimationFrame(f); else res()
          }
          requestAnimationFrame(f)
        })
        const geo0 = g.__l6geo ? g.__l6geo.created : -1
        g.hud.cross(name)
        await p
        let maxGap = 0, over100 = 0
        for (const x of gaps) { if (x > maxGap) maxGap = x; if (x > 100) over100++ }
        let objs = 0, meshes = 0
        g.scene.traverse(o => { objs++; if (o.isMesh) meshes++ })
        const pm = performance.memory
        return { biome: g.biome.current, ok: g.biome.current === name, tSwitch: +tSwitch.toFixed(0),
          maxGap: +maxGap.toFixed(0), over100, geoCreated: g.__l6geo ? g.__l6geo.created - geo0 : -1,
          mem: JSON.parse(JSON.stringify(g.renderer.info.memory)), programs: g.renderer.info.programs.length,
          bodies: g.world.bodies.length, objs, meshes, heap: pm ? pm.usedJSHeapSize : null,
          props: g.props.length, locals: (g.locals || []).length, lastError: g.state.lastError || null,
          started: g.state.started, time: +g.state.time.toFixed(0) }
      }, n)
      rows.push(r)
    }
    laps.push(rows)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-mem.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { pre, laps })
}
