async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const r = { live, spawn: { x: +sp.x.toFixed(1), y: +sp.y.toFixed(1), z: +sp.z.toFixed(1) } }
    const L = g.locals.filter(x => x.biome === live)
    r.locals = L.length
    r.walkers = L.filter(x => x.fig).length
    r.localPos = L.map(x => ({ x: +x.x.toFixed(1), z: +x.z.toFixed(1), fig: !!x.fig,
      nl: (x.lines || []).length, wh: (x.wheek || []).length,
      onTask: x.onTask ? Object.keys(x.onTask).length : 0,
      praise: x.praise ? x.praise.length : 0,
      produce: !!x.produce, chain: !!x.chain }))
    // pair-chat: 13 m radius per brief
    let pairs13 = 0, pairs20 = 0
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const dx = L[i].x - L[j].x, dz = L[i].z - L[j].z, d = Math.hypot(dx, dz)
      if (d < 13) pairs13++
      if (d < 20) pairs20++
    }
    r.pairs13 = pairs13; r.pairs20 = pairs20
    // critters
    r.critters = (g.critters || []).length
    // ownership candidates
    const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
      (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
    r.propsLive = props.length
    const owners = new Set(); const own = []
    for (const p of props) {
      let best = null, bd = 121
      for (const w of L) { if (!w.fig) continue
        const dx = p.homeX - w.ax, dz = p.homeZ - w.az, d2 = dx * dx + dz * dz
        if (d2 < bd) { bd = d2; best = w } }
      if (best) { own.push({ t: p.type, d: +Math.sqrt(bd).toFixed(1) }); owners.add(best) }
    }
    r.ownPairs = own; r.owners = owners.size
    // kyoto api keys
    const k = g.kyoto
    r.apiKeys = Object.keys(k).length
    r.heron = { at: k.heron ? k.heron() : null, standing: k.heronStanding ? k.heronStanding() : null }
    r.stones = k.stones
    r.pond = { x: k.pond.x, z: k.pond.z, r: k.pond.r || k.pond.hx }
    r.bowl = k.bowl; r.bell = k.bell; r.uji = k.uji; r.mill = k.mill
    r.bamboo = k.bamboo; r.zen = k.zen
    r.waterLevel = k.waterLevel
    r.riverLength = k.riverLength ? k.riverLength() : null
    r.runLength = k.runLength ? k.runLength() : null
    // mood table
    try { r.mood = g.weather && g.weather.mood ? JSON.parse(JSON.stringify(g.weather.mood())) : null } catch (e) { r.mood = 'ERR ' + e.message }
    // tasks
    const T = (g.TASKS || []).filter(t => t.chapter === 4)
    r.tasks = T.map(t => ({ id: t.id, done: !!(g.isTaskDone && g.isTaskDone(t.id)), wow: t.wow || '', mini: t.mini || '' }))
    r.loaf = { has: 'loaf' in (g.capy || {}), loaf: g.capy.loaf, loafAsk: typeof g.capy.loafAsk }
    r.calm = g.calm ? g.calm() : null
    r.lastError = g.state && g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=p3k1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}