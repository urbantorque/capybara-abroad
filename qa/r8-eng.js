async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const g = window.__capy
    const W = window
    W.__ev = []
    W.__on = false
    const stamp = (kind, what) => { if (W.__on) W.__ev.push({ b: g.biome.current, kind, what }) }
    const oToast = g.toast, oPunch = g.punch, oSfx = g.sfx
    g.toast = function (s) { stamp('toast', String(s).slice(0, 46)); return oToast.apply(g, arguments) }
    g.punch = function (a) { stamp('punch', a); return oPunch.apply(g, arguments) }
    g.sfx = function (n) { stamp('sfx', n); return oSfx.apply(g, arguments) }
    g.events.on('task:complete', e => stamp('TASK', e && e.id))
    g.events.on('npc:chase', () => stamp('chase', ''))
    g.events.on('npc:startled', () => stamp('startled', ''))
    g.events.on('capy:grab', e => stamp('grab', ''))
    g.events.on('prop:impact', e => { if (e && e.speed > 2.6) stamp('impact', Math.round(e.speed)) })
    W.__drive = null
    W.__dist = 0
    W.__startDrive = seed => {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let s = seed | 0 || 1
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      const cb = g.capy.body
      let px = cb.position.x, pz = cb.position.z
      W.__dist = 0
      W.__drive = setInterval(() => {
        if (rnd() < 0.10) {
          const k = KEYS[(rnd() * KEYS.length) | 0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
        }
        W.__dist += Math.hypot(cb.position.x - px, cb.position.z - pz)
        px = cb.position.x; pz = cb.position.z
      }, 16)
      W.__stopDrive = () => { clearInterval(W.__drive); for (const k of held) up(k) }
    }
  })
  // R8: Pasto, plus the two chapters the original sweep found DEAD (kyoto and
  // cali, both since fixed) and the two it found richest, as the reference
  // classes this batch is aiming Pasto at. Nineteen chapters at 45 s each is
  // fourteen minutes and this has to run twice.
  const NAMES = ["pasto", "quay", "cali", "kyoto", "kowloon"]
  const out = []
  for (let i = 0; i < NAMES.length; i++) {
    await page.evaluate(async name => {
      const g = window.__capy
      window.__on = false
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await new Promise(r => setTimeout(r, 2500))
      window.__ev.length = 0
      window.__on = true
      window.__startDrive(12345 + name.length * 7919)
    }, NAMES[i])
    await page.waitForTimeout(45000)
    const r = await page.evaluate(() => {
      window.__on = false
      window.__stopDrive()
      const tally = {}
      const sfxT = {}
      for (const e of window.__ev) {
        tally[e.kind] = (tally[e.kind] || 0) + 1
        if (e.kind === 'sfx') sfxT[e.what] = (sfxT[e.what] || 0) + 1
      }
      const notes = window.__ev.filter(e => e.kind !== 'sfx').map(e => e.kind + (e.what !== '' ? ':' + e.what : ''))
      return { b: window.__capy.biome.current, dist: Math.round(window.__dist), tally, sfxT, notes: notes.slice(0, 40) }
    })
    out.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=r8-eng.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
