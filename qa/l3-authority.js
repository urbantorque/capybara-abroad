async page => {
  // THE AUTHORITY, AND THE HIDE (L3, F1). Same design as nr-march.js: every
  // live local goes on a 13 m ring (witnessed by all, owned by none), five
  // cones make the chain standing still, and the march is one timeline.
  //   carried   the authority takes the march, reaches you, and the animal is
  //             picked up and put down somewhere else; the task tally is
  //             unchanged
  //   hidden    the same, but the animal is moved into a registered hide spot
  //             the moment somebody sets off: the marcher gives up ("lost
  //             you"), nobody carries anybody
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'load' })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.keyboard.press('Space')
  await page.waitForTimeout(3000)
  const out = { rows: [], errs: [] }
  const CH = ['kyoto', 'hanoi', 'venice']
  for (const ch of CH) {
    for (const mode of ['carried', 'hidden']) {
      await page.evaluate((c) => { const g = window.__capy; try { g.hud.cross(c) } catch (e) { g.biome.switchTo(c) } }, ch)
      await page.waitForTimeout(5000)
      // eighteen metres from the spawn first, so the carry has somewhere to go
      await page.evaluate(() => {
        const g = window.__capy; const b = g.capy.body; const sp = g.biome.spawnOf(g.biome.current)
        const live = g.biome.current; const th = (g[live] && g[live].terrainHeight) ? g[live].terrainHeight : null
        const x = sp.x + 18, z = sp.z; const y = th ? th(x, z) + 0.6 : b.position.y
        b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      })
      await page.waitForTimeout(800)
      const setup = await page.evaluate(() => {
        const g = window.__capy
        const p = g.capy.position
        const live = g.biome.current
        let k = 0, n = 0, auth = null
        for (const r of g.locals) if (r.biome === live && r.group) n++
        for (const r of g.locals) {
          if (r.biome !== live || !r.group) continue
          const a = (k++ / Math.max(1, n)) * 6.283185
          r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13
          r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z
          r.marCool = 0; r.escT = -1
          r.group.position.set(r.x, r.group.position.y, r.z)
          if (r.body) { r.body.position.x = r.x; r.body.position.z = r.z; r.body.aabbNeedsUpdate = true }
          if (r.authority) auth = r.role
        }
        const hides = g.hides().filter(h => h.biome === live)
        return { live, n, auth, hides: hides.length, tasks: g.hud.tasksDone(), p: [+p.x.toFixed(1), +p.z.toFixed(1)] }
      })
      await page.waitForTimeout(600)
      const built = await page.evaluate(() => new Promise((res) => {
        const g = window.__capy
        let dropped = 0, nextDrop = 0
        const t0 = performance.now()
        ;(function step() {
          const t = (performance.now() - t0) / 1000
          if (dropped < 5 && t >= nextDrop) {
            dropped++; nextDrop = t + 1.5
            const p = g.capy.position
            const pr = g.physics.spawnProp('cone', p.x + 1.4, p.z + 1.4)
            if (pr && pr.body) {
              pr.disturbed = true
              pr.lastCapyTouch = g.state ? g.state.time : 0
              pr.body.wakeUp(); pr.body.position.y += 2.4; pr.body.velocity.set(0, -6, 0)
            }
          }
          const a = g.marchAudit ? g.marchAudit() : null
          if ((a && a.on) || t > 12) res({ t: +t.toFixed(1), a })
          else requestAnimationFrame(step)
        })()
      }))
      let moved = null
      if (mode === 'hidden') {
        moved = await page.evaluate(() => {
          const g = window.__capy
          const live = g.biome.current
          const p = g.capy.position
          const hs = g.hides().filter(h => h.biome === live)
          if (!hs.length) return null
          let best = hs[0], bd = 1e9
          for (const h of hs) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h } }
          const b = g.capy.body
          const y = (g[live] && g[live].terrainHeight) ? g[live].terrainHeight(best.x, best.z) + 0.6 : p.y
          b.position.set(best.x, y, best.z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
          return { kind: best.kind, x: +best.x.toFixed(1), z: +best.z.toFixed(1), d: +bd.toFixed(1) }
        })
      }
      const track = await page.evaluate(() => new Promise((res) => {
        const g = window.__capy
        const t0 = performance.now()
        const p0 = { x: g.capy.position.x, z: g.capy.position.z }
        let carried = false, escortSeen = false, hiddenMax = 0, lostSeen = false, why = ''
        const toasts = new Set()
        ;(function step() {
          const t = (performance.now() - t0) / 1000
          const a = g.marchAudit()
          if (g.capy.carriedBy) carried = true
          if (a.escort >= 0) escortSeen = true
          hiddenMax = Math.max(hiddenMax, g.hidden())
          if (a.why === 'lost you') lostSeen = true
          why = a.why
          document.querySelectorAll('.capyui-toast').forEach(e => toasts.add(e.textContent))
          const done = (!a.on && !g.capy.carriedBy && a.escort < 0 && t > 3) || t > 24
          if (done) {
            const p = g.capy.position
            res({ t: +t.toFixed(1), carried, escortSeen, hiddenMax: +hiddenMax.toFixed(2), lostSeen, why,
                  moved: +Math.hypot(p.x - p0.x, p.z - p0.z).toFixed(1), toasts: Array.from(toasts).slice(0, 6),
                  eye: (document.querySelector('.capyui-pipslbl') || {}).textContent || '',
                  tasks: g.hud.tasksDone(), err: g.state.lastError || null })
          } else requestAnimationFrame(step)
        })()
      }))
      out.rows.push({ ch, mode, setup, built: { t: built.t, on: built.a && built.a.on, authority: built.a && built.a.authority, why: built.a && built.a.why }, moved, track })
      await page.screenshot({ path: 'qa/l3-auth-' + ch + '-' + mode + '.png' })
    }
  }
  out.errs = errs.slice(0, 30)
  await page.evaluate((o) => fetch('/shot?name=l3-authority.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
