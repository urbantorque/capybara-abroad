async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  const out = { chapters: [] }
  for (const name of ['venice', 'kowloon']) {
    await page.evaluate(async (n) => { const g = window.__capy; g.hud.cross(n); await new Promise(r => setTimeout(r, 8000)) }, name)
    const b = await page.evaluate((n) => {
      const g = window.__capy
      const api = n === 'sydney' ? g.env : g[n]
      let bb = (api && typeof api.bounds === 'function') ? api.bounds() : null
      const worked = g.biome.boundsOf(n)
      return { own: bb, worked, biome: g.biome.current }
    }, name)
    const box = (b.own && !b.own.rects) ? b.own : b.worked
    const targets = []
    if (box) {
      const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2
      targets.push(['NE', box.x1 + 3, box.z1 + 3], ['NW', box.x0 - 3, box.z1 + 3], ['SE', box.x1 + 3, box.z0 - 3], ['SW', box.x0 - 3, box.z0 - 3],
        ['N', cx, box.z1 + 3], ['S', cx, box.z0 - 3], ['E', box.x1 + 3, cz], ['W', box.x0 - 3, cz])
    }
    const legs = []
    for (const [tag, tx, tz] of targets) {
      const r = await page.evaluate(async ({ n, tag, tx, tz }) => {
        const g = window.__capy
        const sleep = ms => new Promise(r => setTimeout(r, ms))
        const cb = g.capy.body
        const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
        const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
        const api = n === 'sydney' ? g.env : g[n]
        const ground = (x, z) => (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(x, z) : NaN
        const held = new Set(), want = new Set()
        const steer = () => {
          const p = g.capy.position
          let dx = tx - p.x, dz = tz - p.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L
          const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
          const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
          want.clear()
          if (ix < -0.3) want.add('KeyA'); if (ix > 0.3) want.add('KeyD')
          if (iz < -0.3) want.add('KeyW'); if (iz > 0.3) want.add('KeyS')
          for (const k of held) if (!want.has(k)) { up(k); held.delete(k) }
          for (const k of want) if (!held.has(k)) { down(k); held.add(k) }
        }
        down('ShiftLeft')
        const t0 = performance.now()
        let minUnder = 1e9, worstAt = null, belowN = 0, teleports = 0, nan = 0, samples = 0, stillN = 0, stillMax = 0, stillRun = 0, hopN = 0
        let lx = cb.position.x, ly = cb.position.y, lz = cb.position.z, lastD = 1e9, closest = 1e9, closestAt = null
        const toasts = new Set()
        let outsideN = 0
        while (performance.now() - t0 < 14000) {
          steer()
          // a hop every ~2 s when stuck, like a player would
          if (stillRun > 12 && (samples % 16) === 0) { down('Space'); hopN++; setTimeout(() => up('Space'), 120) }
          await sleep(100)
          const p = g.capy.position, v = cb.velocity
          if ([p.x, p.y, p.z, v.x, v.y, v.z].some(q => q !== q)) { nan++; continue }
          samples++
          const gy = ground(p.x, p.z)
          if (gy === gy) { const u = p.y - gy; if (u < minUnder) { minUnder = u; worstAt = [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1), +gy.toFixed(2)] } if (u < -0.6) belowN++ }
          const jump = Math.hypot(p.x - lx, p.y - ly, p.z - lz)
          if (jump > 4) teleports++
          if (Math.hypot(p.x - lx, p.z - lz) < 0.02) { stillN++; stillRun++; if (stillRun > stillMax) stillMax = stillRun } else stillRun = 0
          lx = p.x; ly = p.y; lz = p.z
          const d = Math.hypot(tx - p.x, tz - p.z); if (d < closest) { closest = d; closestAt = [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)] }
          if (d < 1.5) break
          const bx = window.__l7box
          for (const el of document.querySelectorAll('.capyui-toast')) { const t = (el.textContent || '').trim(); if (t) toasts.add(t.slice(0, 70)) }
        }
        for (const k of held) up(k); up('ShiftLeft'); up('Space')
        await sleep(300)
        const p = g.capy.position
        return { tag, target: [+tx.toFixed(0), +tz.toFixed(0)], closest: +closest.toFixed(1), closestAt, end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)], minUnder: +minUnder.toFixed(2), worstAt, belowN, teleports, nan, samples, stillN, stillMax: +(stillMax * 0.1).toFixed(1), hopN,
          toasts: [...toasts].filter(t => /put you back|not part|back/i.test(t)), lastError: g.state.lastError || null, camY: +g.camera.position.y.toFixed(1) }
      }, { n: name, tag, tx, tz })
      legs.push(r)
    }
    // the void: put the body 40 m outside the box and 30 m under it; does the rescue fire and how long
    const voidT = await page.evaluate(async ({ n, box }) => {
      const g = window.__capy
      const sleep = ms => new Promise(r => setTimeout(r, ms))
      const cb = g.capy.body
      const res = []
      for (const [tag, x, y, z] of [['outside', box.x1 + 40, 2, box.z1 + 40], ['under', (box.x0 + box.x1) / 2, -30, (box.z0 + box.z1) / 2]]) {
        cb.wakeUp(); cb.position.set(x, y, z); cb.velocity.set(0, 0, 0); cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        const t0 = performance.now(); let back = -1
        const toasts = new Set()
        while (performance.now() - t0 < 9000) {
          await sleep(100)
          const p = g.capy.position
          const api = n === 'sydney' ? g.env : g[n]
          const gy = api && api.terrainHeight ? api.terrainHeight(p.x, p.z) : 0
          const inside = p.x >= box.x0 - 1 && p.x <= box.x1 + 1 && p.z >= box.z0 - 1 && p.z <= box.z1 + 1 && p.y > gy - 1
          for (const el of document.querySelectorAll('.capyui-toast')) { const t = (el.textContent || '').trim(); if (t) toasts.add(t.slice(0, 70)) }
          if (inside && back < 0) { back = performance.now() - t0; await sleep(1500); break }
        }
        const p = g.capy.position
        res.push({ tag, backMs: +back.toFixed(0), end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)], toasts: [...toasts], lastError: g.state.lastError || null })
      }
      return res
    }, { n: name, box })
    out.chapters.push({ name, biome: b.biome, ownBounds: !!b.own, box, legs, voidT })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-corners.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
