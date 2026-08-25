async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(7000)
  await page.mouse.click(500, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    let tt = 0
    const toasts = [], sfx = []
    const t0 = g.toast
    g.toast = function (s) { toasts.push({ s: String(s).slice(0, 70), t: +tt.toFixed(1), n: +g.cali.night().toFixed(2) }); return t0.apply(g, arguments) }
    const s0 = g.sfx
    g.sfx = function (n, op) { sfx.push({ n: n, t: +tt.toFixed(1), at: !!(op && op.at), v: op && op.volume }); return s0.apply(g, arguments) }
    g.biome.switchTo('cali')
    const sp = g.biome.spawnOf('cali'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) { g.tick(1 / 60, false); tt += 1 / 60 }
    const c = g.cali
    const stick = () => {
      const a = c.chivaAt()
      b.position.set(a.x, a.y + 3.70 + 0.34, a.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    stick()
    const marks = {}
    let arrivedAt = -1, wireHits = 0
    const camAt = []
    for (let i = 0; i < 60 * 260; i++) {
      if (!c.onChiva()) stick()
      g.tick(1 / 60, false); tt += 1 / 60
      const n = c.night(), p = c.rideProgress(), a = c.chivaAt()
      for (const k of [0.02, 0.30, 0.50, 0.60, 0.75, 0.995]) {
        if (marks['n' + k] === undefined && n >= k) {
          marks['n' + k] = { t: +tt.toFixed(1), rideProg: +p.toFixed(3),
            x: +a.x.toFixed(0), y: +a.y.toFixed(0), z: +a.z.toFixed(0),
            dFloor: +Math.hypot(a.x - c.floor.x, a.z - c.floor.z).toFixed(0),
            dMir: +Math.hypot(a.x - c.mirador.x, a.z - c.mirador.z).toFixed(0) }
        }
      }
      if (c.chivaState() === 'arrived' && arrivedAt < 0) { arrivedAt = tt }
      if (arrivedAt > 0 && tt - arrivedAt > 8) break
    }
    o.marks = marks
    o.rideSecs = +tt.toFixed(1)
    o.arrivedAt = +arrivedAt.toFixed(1)
    o.state = c.chivaState()
    o.night = c.night()
    o.toasts = toasts
    o.sfx = sfx.slice(-40)
    o.sfxMono = sfx.filter(s => !s.at).length
    o.sfxPos = sfx.filter(s => s.at).length
    o.done = { mirador: !!(g.journey && g.journey.done && g.journey.done('chiva-mirador')) }
    // camera at the payout
    const cam = g.camera
    o.cam = cam ? { x: +cam.position.x.toFixed(1), y: +cam.position.y.toFixed(1), z: +cam.position.z.toFixed(1) } : null
    o.capy = { x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1) }
    o.dMirNow = +Math.hypot(g.capy.position.x - c.mirador.x, g.capy.position.z - c.mirador.z).toFixed(1)
    // ---- can floor-after-dark be reached now? -----------------------------
    o.floorWalk = +Math.hypot(c.mirador.x - c.floor.x, c.mirador.z - c.floor.z).toFixed(0)
    o.err = g.state ? (g.state.lastError || null) : null
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
