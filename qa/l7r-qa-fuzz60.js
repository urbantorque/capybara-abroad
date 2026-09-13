async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 240)) })
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 240)))
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  const names = ['sydney', 'venice', 'kowloon', 'hanoi', 'goreme', 'cave', 'drift', 'monaco', 'manly', 'antarctic']
  const rows = []
  for (const n of names) {
    await page.evaluate(async (name) => { const g = window.__capy; g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) }, n)
    const agg = { name: n, biome: null, ok: false, chunks: [], nan: 0, belowVoid: 0, teleports: 0, maxSpeed: 0, minY: 1e9, maxY: -1e9, saves: 0, maxGap: 0, over100: 0, errs: [], lastError: null, toasts: [] }
    for (let c = 0; c < 3; c++) {
      const r = await page.evaluate(async (arg) => {
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
        const g = window.__capy
        const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft', 'KeyG', 'KeyF', 'KeyR', 'KeyV', 'KeyX', 'KeyC', 'ArrowLeft', 'ArrowRight']
        const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
        const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
        let s = (987654 ^ (arg.name.length * 7919)) + arg.chunk * 104729
        const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
        const held = new Set()
        const saves0 = g.state.solverSaves || 0
        let nan = 0, belowVoid = 0, teleports = 0, maxSpeed = 0, minY = 1e9, maxY = -1e9
        let lx = g.capy.position.x, ly = g.capy.position.y, lz = g.capy.position.z
        const gaps = []; let last = performance.now()
        const toasts = new Set()
        const t0 = performance.now()
        const raf = (t) => { gaps.push(t - last); last = t; if (performance.now() - t0 < 19000) requestAnimationFrame(raf) }
        requestAnimationFrame(raf)
        const key = arg.name === 'sydney' ? 'env' : arg.name
        while (performance.now() - t0 < 19000) {
          if (rnd() < 0.10) {
            const k = KEYS[(rnd() * KEYS.length) | 0]
            if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
          }
          await sleep(16)
          const p = g.capy.position, v = g.capy.body.velocity
          if (!(p.x === p.x && p.y === p.y && p.z === p.z)) nan++
          if (!(v.x === v.x && v.y === v.y && v.z === v.z)) nan++
          const mod = g[key]
          const terr = (mod && mod.terrainHeight) ? mod.terrainHeight(p.x, p.z) : 0
          if (p.y < (terr === terr ? terr : 0) - 8) belowVoid++
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
          const spd = Math.hypot(v.x, v.y, v.z); if (spd > maxSpeed) maxSpeed = spd
          if (Math.hypot(p.x - lx, p.y - ly, p.z - lz) > 4) teleports++
          lx = p.x; ly = p.y; lz = p.z
          for (const el of document.querySelectorAll('.capyui-toast')) { const tx = (el.textContent || '').trim(); if (/put you back|not part of the world/i.test(tx)) toasts.add(tx.slice(0, 60)) }
        }
        for (const k of held) up(k)
        await sleep(200)
        gaps.shift()
        return { biome: g.biome.current, nan, belowVoid, teleports, maxSpeed: +maxSpeed.toFixed(1), minY: +minY.toFixed(2), maxY: +maxY.toFixed(2),
          saves: (g.state.solverSaves || 0) - saves0, maxGap: +Math.max.apply(null, gaps).toFixed(0), over100: gaps.filter(x => x > 100).length,
          lastError: g.state.lastError || null, toasts: [...toasts], pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)] }
      }, { name: n, chunk: c })
      agg.biome = r.biome; agg.ok = r.biome === n
      agg.chunks.push(r.pos)
      agg.nan += r.nan; agg.belowVoid += r.belowVoid; agg.teleports += r.teleports; agg.maxSpeed = Math.max(agg.maxSpeed, r.maxSpeed)
      agg.minY = Math.min(agg.minY, r.minY); agg.maxY = Math.max(agg.maxY, r.maxY); agg.saves += r.saves
      agg.maxGap = Math.max(agg.maxGap, r.maxGap); agg.over100 += r.over100; agg.lastError = agg.lastError || r.lastError
      for (const t of r.toasts) if (!agg.toasts.includes(t)) agg.toasts.push(t)
    }
    agg.errsSoFar = errs.length
    rows.push(agg)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-fuzz60.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { rows, errs: errs.slice(0, 40), errN: errs.length })
}
