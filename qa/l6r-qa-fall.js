async page => {
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => window.__capy.hud.cross(name), n)
    await page.waitForTimeout(9000)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = name === 'sydney' ? g.env : g[name]
      const fall = [], fast = [], awake = []
      let n = 0
      for (const pr of g.props) {
        if (!pr.body || pr.removed || pr.hidden) continue
        if (pr.biome && pr.biome !== name) continue
        n++
        const b = pr.body, p = b.position, v = b.velocity
        const sp = Math.hypot(v.x, v.y, v.z)
        const terr = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(p.x, p.z) : NaN
        const row = { kind: pr.kind || pr.type || '?', pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], sp: +sp.toFixed(1), inWater: !!pr.inWater, sunk: !!pr.sunk,
          homeY: +(+pr.homeY).toFixed(1), terr: terr === terr ? +terr.toFixed(1) : null, overWater: !!(api && api.isOverWater && api.isOverWater(p.x, p.z)),
          waterY: (api && typeof api.waterHeight === 'function') ? api.waterHeight(p.x, p.z) : (api && typeof api.waterY === 'number' ? api.waterY : null), sleep: b.sleepState }
        if (p.y < (terr === terr ? terr : 0) - 8 || p.y < -20) fall.push(row)
        else if (sp > 40) fast.push(row)
        if (b.sleepState !== 2 && sp > 0.5) awake.push(row.kind)
      }
      // and any non-prop body far under
      let deep = 0
      for (const b of g.world.bodies) if (b.position.y < -50) deep++
      return { biome: g.biome.current, ok: g.biome.current === name, props: n, fall, fast, awakeMoving: awake.length, deepBodies: deep, saves: g.state.solverSaves || 0 }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-fall.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
