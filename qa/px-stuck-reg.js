async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 900, height: 560 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']

  const RUN = (name) => {
    const g = window.__capy
    const b = g.capy.body
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    const sp = g.biome.spawnOf(name)
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    // deterministic pseudo-random input, same sequence every run
    let seed = 20260904
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    let held = null, jumps = 0, maxJump = 0, py = b.position.y, px = b.position.x, pz = b.position.z
    const N = 600
    for (let i = 0; i < N; i++) {
      if (i % 20 === 0) {
        if (held) up(held)
        held = KEYS[Math.floor(rnd() * KEYS.length)]
        down(held)
      }
      g.tick(1 / 60, false)
      const d = Math.hypot(b.position.x - px, b.position.y - py, b.position.z - pz)
      if (d > 0.5) { jumps++; if (d > maxJump) maxJump = d }
      px = b.position.x; py = b.position.y; pz = b.position.z
    }
    if (held) up(held)
    return { name, live: g.biome.current, jumps, maxJump: +maxJump.toFixed(2),
             endY: +b.position.y.toFixed(2), err: (g.state && g.state.lastError) || null }
  }

  const out = { at: new Date().toISOString(), rows: [] }
  for (const n of NAMES) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, n)
      await page.waitForTimeout(3200)
      out.rows.push(await page.evaluate(RUN, n))
    } catch (e) { out.rows.push({ name: n, error: String(e).slice(0, 160) }) }
  }
  await page.evaluate(o => fetch('/shot?name=px-stuck-reg.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
