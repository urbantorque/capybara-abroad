// PAYOFF batch 1, job 1(b): NPC HEALTH ACROSS ALL SEVENTEEN, LIVE-GATED.
//
// qa/npchealth.js watches `game.npcs`, which is the Sydney and Pasto cast and
// nobody else — the other fifteen chapters are populated entirely by `locals`,
// which that audit has never looked at. And it measures every record in the
// array including the ones belonging to a DETACHED biome, which is why running
// it in Pasto reports all of Sydney "stuck, moved 0.0 m". Both halves are fixed
// here: locals are audited too, and NOTHING is measured unless its biome is the
// live one.
//
// What a local must satisfy:
//   - on the ground (within 1.2 m below / 3.5 m above the chapter's terrain)
//   - within npcLOC_STEP_R + slack of the anchor the chapter chose
//   - carrying a static body, and that body at the person's feet
//   - finite everywhere
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)

  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                 'cave', 'antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      window.__nh = { live: name, max: {}, states: {}, off: [], moved: {}, start: {}, locals: null }
    }, n)
    await page.waitForTimeout(1200)
    await page.evaluate(() => {
      const g = window.__capy
      window.__nhTimer = setInterval(() => {
        const N = window.__nh
        const live = g.biome.current
        if (live !== N.live) return
        const gy = (x, z) => {
          const api = live === 'sydney' ? g.env : g[live]
          const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0
          return (typeof h === 'number' && h === h) ? h : 0
        }
        // ---- the steering cast (Sydney and Pasto) ---------------------------
        for (const r of g.npcs) {
          if (!r || !r.group) continue
          // LIVE ONLY. A detached biome's cast is frozen by design, and the
          // steering records carry their chapter in their id and nowhere else:
          // Sydney's are 'npc<n>' / 'ibis<n>', Pasto's are 'pasto-<kind><n>'.
          // Getting this wrong is the cry-wolf in qa/npchealth.js — it reports
          // all 38 of Sydney "stuck, moved 0.0 m" whenever it is not in Sydney.
          const rb = String(r.id || '').indexOf('pasto-') === 0 ? 'pasto' : 'sydney'
          if (rb !== live) continue
          const p = r.group.position
          const id = (r.kind || '?') + '#' + r.id
          N.states[id] = N.states[id] || {}
          N.states[id][r.state] = (N.states[id][r.state] || 0) + 1
          N.max[id] = Math.max(N.max[id] || 0, r.stateT || 0)
          if (!N.start[id]) N.start[id] = [p.x, p.z]
          N.moved[id] = Math.max(N.moved[id] || 0, Math.hypot(p.x - N.start[id][0], p.z - N.start[id][1]))
          const dy = p.y - gy(p.x, p.z)
          if (!(p.x === p.x && p.y === p.y && p.z === p.z)) N.off.push(id + ' NaN')
          else if (dy < -1.2 || dy > 3.5) N.off.push(id + ' dy=' + dy.toFixed(1) + ' state=' + r.state)
        }
        // ---- the locals, which are fifteen chapters' entire population ------
        const L = g.locals || []
        let n = 0, drift = 0, nobody = 0, sunk = 0, bodyOff = 0
        for (const r of L) {
          if (r.biome !== live) continue
          n++
          const d = Math.hypot(r.x - r.ax, r.z - r.az)
          if (d > 0.95) { drift = Math.max(drift, d); N.off.push('local drift ' + d.toFixed(2) + 'm') }
          if (!r.body) nobody++
          else {
            const bp = r.body.position
            if (Math.hypot(bp.x - r.x, bp.z - r.z) > 0.15) bodyOff++
          }
          const dy = r.y - gy(r.x, r.z)
          if (!(r.x === r.x && r.z === r.z)) N.off.push('local NaN')
          else if (dy < -1.2 || dy > 3.5) {
            sunk++
            N.off.push('local off-ground dy=' + dy.toFixed(1) +
                       ' at ' + r.x.toFixed(0) + ',' + r.y.toFixed(1) + ',' + r.z.toFixed(0) +
                       ' says "' + ((r.lines && r.lines[0] && (r.lines[0].t || r.lines[0])) || '?') + '"')
          }
        }
        N.locals = { n, drift: +drift.toFixed(2), nobody, sunk, bodyOff }
      }, 250)
    })
    for (let i = 0; i < 5; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
    out[n] = await page.evaluate(() => {
      clearInterval(window.__nhTimer)
      const N = window.__nh
      const stuck = []
      for (const id in N.max) {
        const keys = Object.keys(N.states[id])
        if (keys.length <= 1 && (N.moved[id] || 0) < 1.0) stuck.push(id + ' always ' + keys[0] + ' moved ' + (N.moved[id] || 0).toFixed(1) + 'm')
        else if (N.max[id] > 34) stuck.push(id + ' held one state ' + N.max[id].toFixed(0) + 's moved ' + (N.moved[id] || 0).toFixed(1) + 'm')
      }
      return { steering: Object.keys(N.max).length, stuck, locals: N.locals,
               off: [...new Set(N.off)].slice(0, 10) }
    })
  }
  out.__errs = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=pfnpchealth.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
