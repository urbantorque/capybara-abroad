async page => {
  await page.evaluate(() => window.__capy.hud.cross('monaco'))
  await page.waitForTimeout(8000)
  const r = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft']
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    let s = 1234567 ^ 'monaco'.length * 7919
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
    const held = new Set()
    const saves0 = g.state.solverSaves || 0
    const hits = {}
    // hook: sample every body's velocity BEFORE mainSaneWorld would clamp — use postStep
    const w = g.world
    const onPost = () => {
      for (const b of w.bodies) {
        const v = b.velocity, p = b.position
        const sp = Math.hypot(v.x, v.y, v.z)
        const nan = !(p.x === p.x && p.y === p.y && p.z === p.z && v.x === v.x && v.y === v.y && v.z === v.z)
        if (sp > 80 || nan) {
          const sh = b.shapes[0]
          const key = (b.mass <= 0 ? 'static/kin' : 'dyn') + ' type' + b.type + ' shape' + (sh ? sh.type : '?') + ' mass' + b.mass + ' ' + (b.__capyName || b.capyName || b.name || (b.__prop && b.__prop.kind) || '') + (b === g.capy.body ? ' CAPY' : '')
          hits[key] = hits[key] || { n: 0, maxSp: 0, nan: 0, pos: null, r: sh && sh.radius, he: sh && sh.halfExtents ? [sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z] : null }
          hits[key].n++; hits[key].maxSp = Math.max(hits[key].maxSp, sp); if (nan) hits[key].nan++
          hits[key].pos = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]
        }
      }
    }
    w.addEventListener('postStep', onPost)
    const t0 = performance.now()
    while (performance.now() - t0 < 8000) {
      if (rnd() < 0.09) {
        const k = KEYS[(rnd() * KEYS.length) | 0]
        if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
      }
      await sleep(16)
    }
    for (const k of held) up(k)
    w.removeEventListener('postStep', onPost)
    // which props are these? match by position
    const near = []
    for (const k in hits) {
      const h = hits[k]
      let best = null, bd = 1e9
      for (const pr of g.props) { if (!pr.body) continue; const d = Math.hypot(pr.body.position.x - h.pos[0], pr.body.position.z - h.pos[2]); if (d < bd) { bd = d; best = pr } }
      near.push({ key: k, hit: h, prop: best ? { kind: best.kind || best.type || best.name, biome: best.biome, d: +bd.toFixed(1), mass: best.mass } : null })
    }
    return { biome: g.biome.current, saves: (g.state.solverSaves || 0) - saves0, near }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-monaco.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, r)
}
