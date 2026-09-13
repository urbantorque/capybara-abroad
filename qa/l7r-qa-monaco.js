async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-carry'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'monaco') { g.hud.cross('monaco'); await new Promise(r => setTimeout(r, 8000)) } })
  const chunks = []
  for (let c = 0; c < 3; c++) {
    const r = await page.evaluate(async (arg) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft', 'KeyG', 'KeyF', 'KeyR', 'KeyV', 'KeyX', 'KeyC', 'ArrowLeft', 'ArrowRight']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let s = (987654 ^ ('monaco'.length * 7919)) + arg.chunk * 104729
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      const events = []
      let maxSpeed = 0, prevSpd = 0
      const t0 = performance.now()
      while (performance.now() - t0 < 19000) {
        if (rnd() < 0.10) { const k = KEYS[(rnd() * KEYS.length) | 0]; if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) } }
        await sleep(16)
        const p = g.capy.position, v = g.capy.body.velocity
        const spd = Math.hypot(v.x, v.y, v.z)
        if (spd > maxSpeed) maxSpeed = spd
        if (spd > 25 && prevSpd <= 25 && events.length < 12) {
          // what is near: the nearest kinematic/moving body and any pill on screen
          let best = null, bd = 1e9
          for (const b of g.world.bodies) { if (b === g.capy.body || b.mass !== 0 && b.type !== 4) continue; const d = Math.hypot(b.position.x - p.x, b.position.y - p.y, b.position.z - p.z); const mv = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z); if (b.type === 4 && d < bd) { bd = d; best = { type: b.type, d: +d.toFixed(1), v: +mv.toFixed(1), shapes: b.shapes.map(sh => sh.constructor.name).join(','), y: +b.position.y.toFixed(1) } } }
          const pills = [...document.querySelectorAll('.capyui-toast, .capyui-pill, .capyui-live')].map(e => e.textContent.trim().slice(0, 70)).filter(Boolean)
          events.push({ t: +((performance.now() - t0) / 1000).toFixed(1), spd: +spd.toFixed(1), v: [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)], pos: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)], held: [...held], carriedBy: g.capy.carriedBy ? (g.capy.carriedBy.name || typeof g.capy.carriedBy) : null, atHelm: !!g.capy.atHelm, nearestKin: best, pills, shove: g.shove && g.shove.src ? g.shove.src : (g.state.shoveSrc || null) })
        }
        prevSpd = spd
      }
      for (const k of held) up(k)
      await sleep(200)
      return { maxSpeed: +maxSpeed.toFixed(1), events, saves: g.state.solverSaves, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)], lastError: g.state.lastError || null }
    }, { chunk: c })
    chunks.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-monaco.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { chunks })
}
