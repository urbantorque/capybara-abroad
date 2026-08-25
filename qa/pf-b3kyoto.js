async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    const park = (x, y, z) => {
      const b = g.capy.body
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      settle(60)
    }
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto')
    park(sp.x, sp.y, sp.z)
    const K = g.kyoto
    R.spawn = { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) }
    R.api = Object.keys(K || {}).join(',')

    // ---- PILLAR 2: cast --------------------------------------------------
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)
    R.locals = L.length
    R.walkers = L.filter(r => r.fig).length
    R.withLines = L.filter(r => r.lines && r.lines.length).length
    R.withBeforeAfter = L.filter(r => (r.lines || []).some(l => l && (l.before || l.after))).length
    R.withOnTask = L.filter(r => r.onTask && Object.keys(r.onTask).length).length
    // pair distances
    let pairs = 0, closest = 1e9
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j]
      if (!a.pos || !b.pos) continue
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z)
      if (d < closest) closest = d
      if (d < 13) pairs++
    }
    R.pairsUnder13 = pairs
    R.closestPair = +closest.toFixed(2)

    // ---- edibles / ownership --------------------------------------------
    const P = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    R.props = P.length
    R.edible = P.filter(p => p.edible).length
    R.owned = P.filter(p => p.own || p.owner).length
    R.propKinds = P.map(p => p.kind || p.name || (p.mesh && p.mesh.name) || '?').join(',')

    // ---- critters --------------------------------------------------------
    const a0 = g.hud.calmAudit ? g.hud.calmAudit() : null
    R.crittersLive = a0 ? a0.critters.filter(c => c.live).map(c => ({ b: c.biome, r: +c.r.toFixed(1), near: +c.near.toFixed(2), appr: +c.appr.toFixed(2), bold: c.bold })) : 'no calmAudit'

    // ---- PILLAR 3: surface pitch across the chapter ----------------------
    R.zones = {}
    const probe = [['spawn/gion', sp.x, sp.z], ['zen', -34, 8], ['pond N', 26, -22],
      ['bamboo mid', -84, -44], ['bamboo S', -84, -74], ['torii low', -6, -46],
      ['torii top', -30, -100], ['uji town', 24, 176], ['mill', 54, 148],
      ['bowl', 24, 196], ['bridge', 4, 128]]
    for (const [n, x, z] of probe) {
      R.zones[n] = { y: +K.terrainHeight(x, z).toFixed(2),
        water: !!K.isOverWater(x, z),
        z: ['torii', 'zen', 'gion', 'bamboo', 'uji'].filter(t => K.inZone(t, x, z)).join('+') || '-' }
    }
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3k1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
