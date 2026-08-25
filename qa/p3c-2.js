async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, out = {}
    let tt = 0
    const toasts = []
    const t0 = g.toast
    g.toast = function (s) { toasts.push({ s: s, t: +tt.toFixed(1), n: +g.cali.night().toFixed(3), p: +g.cali.rideProgress().toFixed(3) }); return t0.apply(g, arguments) }
    const sfx = []
    const s0 = g.sfx
    g.sfx = function (n, o) { sfx.push({ n: n, t: +tt.toFixed(1) }); return s0.apply(g, arguments) }
    g.biome.switchTo('cali')
    for (let i = 0; i < 120; i++) { g.tick(1 / 60, false); tt += 1 / 60 }
    const c = g.cali, b = g.capy.body
    const stick = () => {
      const a = c.chivaAt()
      b.position.set(a.x, a.y + 3.70 + 0.34, a.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    stick()
    const trace = []
    const marks = {}
    let arrivedAt = -1
    for (let i = 0; i < 12000; i++) {
      if (!c.onChiva()) stick()
      g.tick(1 / 60, false); tt += 1 / 60
      const n = c.night(), p = c.rideProgress(), a = c.chivaAt()
      for (const k of [0.02, 0.30, 0.50, 0.60, 0.75, 0.99]) {
        if (marks['n' + k] === undefined && n >= k) {
          marks['n' + k] = { t: +tt.toFixed(1), prog: +p.toFixed(3), x: +a.x.toFixed(1), y: +a.y.toFixed(1), z: +a.z.toFixed(1),
            dFloor: +Math.hypot(a.x - c.floor.x, a.z - c.floor.z).toFixed(1),
            dMir: +Math.hypot(a.x - c.mirador.x, a.z - c.mirador.z).toFixed(1) }
        }
      }
      if (i % 30 === 0) trace.push([+tt.toFixed(1), +n.toFixed(3), +p.toFixed(3), +a.x.toFixed(1), +a.y.toFixed(1), +a.z.toFixed(1), c.chivaState()])
      if (c.chivaState() === 'arrived' && arrivedAt < 0) arrivedAt = tt
      if (arrivedAt > 0 && tt - arrivedAt > 6) break
    }
    out.marks = marks
    out.trace = trace
    out.toasts = toasts
    out.sfxKinds = sfx.reduce((m, s) => { m[s.n] = (m[s.n] || 0) + 1; return m }, {})
    out.rideSecs = +tt.toFixed(1)
    out.arrived = c.chivaState()
    out.night = c.night()
    out.doneMirador = g.tasks ? !!(g.tasks.done && g.tasks.done('chiva-mirador')) : null
    out.taskState = (g.journey && g.journey.done) ? g.journey.done('chiva-mirador') : null
    out.err = g.state.lastError || null
    // ---- which local lines resolve NOW (night = 1, at the mirador) --------
    const locs = (g.locals || []).filter(L => L.biome === 'cali')
    out.locals = locs.map(L => ({ x: +L.x.toFixed(1), z: +L.z.toFixed(1), near: L.near,
      lines: (L.lines || []).length,
      hasWhen: (L.lines || []).filter(e => e && e.when).length,
      hasAfter: (L.lines || []).filter(e => e && e.after).length,
      hasBefore: (L.lines || []).filter(e => e && e.before).length,
      onTask: L.onTask ? Object.keys(L.onTask).length : 0,
      wheek: (L.wheekLines || []).length }))
    return out
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p3c2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
