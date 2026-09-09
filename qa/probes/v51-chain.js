async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const g = window.__capy
    const W = window
    W.__c = { imp: 0, fast: 0, dist: 0, seen: 0, tick: 0 }
    const people = (x, z, r) => {
      let n = 0
      for (const q of (g.npcs || [])) {
        const p = q && q.group ? q.group.position : null
        if (p && Math.hypot(p.x - x, p.z - z) < r) n++
      }
      for (const q of (g.locals || [])) {
        if (!q || q.biome !== g.biome.current) continue
        if (Math.hypot(q.x - x, q.z - z) < r) n++
      }
      return n
    }
    g.events.on('prop:impact', e => {
      W.__c.imp++
      if (!e || !(e.speed > 2.6)) return
      W.__c.fast++
      if (!(e.prop && e.prop.disturbed)) return
      W.__c.dist++
      const p = e.position
      if (p && people(p.x, p.z, 16) > 0) W.__c.seen++
    })
    const oS = g.sfx
    g.sfx = function (n) { if (n === 'tick') W.__c.tick++; return oS.apply(g, arguments) }
    W.__drive = null
    W.__start = () => {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let s = 424242
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      W.__drive = setInterval(() => {
        if (rnd() < 0.12) {
          const k = KEYS[(rnd() * KEYS.length) | 0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
        }
      }, 16)
      W.__stop = () => { clearInterval(W.__drive); for (const k of held) up(k) }
    }
    W.__start()
  })
  await page.waitForTimeout(75000)
  const out = await page.evaluate(() => { window.__stop(); return window.__c })
  await page.evaluate(o => fetch('/shot?name=v51chain.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
