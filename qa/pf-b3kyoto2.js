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
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(120)
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)

    // ---- PILLAR 2: chat geometry ----------------------------------------
    R.groupable = L.filter(r => r.group).length
    let p13 = 0, p20 = 0, closest = 1e9
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z)
      if (d < closest) closest = d
      if (d < 13) p13++
      if (d < 20) p20++
    }
    R.pairs13 = p13; R.pairs20 = p20; R.closest = +closest.toFixed(2)
    R.groupPairs13 = (() => { let n = 0
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
        if (L[i].group && L[j].group && Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z) < 13) n++
      return n })()
    // did a chat actually fire in 60 s of sim?
    let chats = 0
    const seen = new Set()
    for (let i = 0; i < 60 * 60; i++) {
      settle(1)
      for (const r of L) if (r.chatT > 4.5 && !seen.has(r)) { seen.add(r); chats++ }
    }
    R.chatsIn60s = chats

    // ---- ownership --------------------------------------------------------
    const walkers = L.filter(r => r.fig)
    const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
      (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
    R.nProps = props.length
    const owners = new Set(); const own = []
    for (const p of props) {
      let best = null, bd = 121
      for (const r of walkers) { const d2 = (p.homeX - r.ax) ** 2 + (p.homeZ - r.az) ** 2
        if (d2 < bd) { bd = d2; best = r } }
      if (best) { own.push({ t: p.type, d: +Math.sqrt(bd).toFixed(1) }); owners.add(best) }
    }
    R.ownedProps = own.length; R.owners = owners.size; R.ownSample = own
    R.propTypes = props.map(p => p.type).join(',')
    R.typeDefs = props.map(p => { const d = g.physics.typeOf ? g.physics.typeOf(p.type) : null
      return p.type + ':' + (d ? (d.edible ? 'EDIBLE' : 'no') + '/m' + d.mass : '?') }).join(' | ')

    // ---- PILLAR 3: the loaf + the heron inversion, HERE -------------------
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    settle(60)
    const dump = () => { const a = g.hud.calmAudit()
      return { loaf: +a.loaf.toFixed(2), calm: +a.calm.toFixed(2),
        c: a.critters.filter(c => c.live).map(c => ({ r: +c.r.toFixed(2), near: +c.near.toFixed(2), appr: +c.appr.toFixed(2), bold: c.bold })) } }
    R.critBefore = dump()
    let loafAt = -1
    for (let i = 0; i < 60 * 25; i++) { settle(1); if (loafAt < 0 && g.capy.loaf > 0.5) loafAt = +(i / 60).toFixed(2) }
    R.loafAtS = loafAt
    R.critAfter = dump()
    // is the heron actually near the player's route, i.e. observable?
    try { const h = g.kyoto.heron
      R.heron = h ? JSON.stringify({ x: h.x, z: h.z, px: h.position && h.position.x, pz: h.position && h.position.z, keys: Object.keys(h).slice(0, 12) }) : 'none' }
    catch (e) { R.heron = 'err ' + e.message }
    try { R.heronStanding = g.kyoto.heronStanding ? g.kyoto.heronStanding() : null } catch (e) { R.heronStanding = 'err' }
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3k2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
