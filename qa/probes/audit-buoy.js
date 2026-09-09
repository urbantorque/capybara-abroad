async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(700)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = name === 'sydney' ? g.env : g[name]
      const sp = g.biome.spawnOf(name)
      const over = api && api.isOverWater ? api.isOverWater.bind(api) : null
      const wh = api && api.waterHeightAt ? api.waterHeightAt.bind(api) : null
      const terr = api && api.terrainHeight ? api.terrainHeight.bind(api) : null
      let wpt = null
      if (over) {
        for (let r = 4; r < 160 && !wpt; r += 4) {
          for (let a = 0; a < 24; a++) {
            const x = sp.x + Math.cos(a/24*6.283)*r, z = sp.z + Math.sin(a/24*6.283)*r
            if (over(x, z)) { wpt = { x: +x.toFixed(1), z: +z.toFixed(1) }; break }
          }
        }
      }
      const types = ['ball','bin','winebottle','camera','frisbee','flower']
      const res = { waterPoint: wpt, land: [], water: [] }
      const made = []
      const run = (list, x, z, lift) => {
        for (const t of types) {
          const p = g.physics.spawnProp(t, x, z)
          if (!p) { list.push({ t, err: 'nospawn' }); continue }
          made.push(p)
          p.body.wakeUp()
          if (lift != null) { p.body.position.y = lift; p.body.velocity.set(0,0,0) }
        }
      }
      run(res.land, sp.x + 1.5, sp.z + 1.5, null)
      if (wpt) run(res.water, wpt.x, wpt.z, (wh ? wh(wpt.x, wpt.z) : 0) + 2.0)
      for (let i = 0; i < 420; i++) g.tick(1/60, false)
      let k = 0
      const grab = (list, x, z, isWater) => {
        for (const t of types) {
          const p = made[k++]
          if (!p) continue
          const y = p.body.position.y - p.originY
          const gnd = terr ? terr(p.body.position.x, p.body.position.z) : 0
          const w = wh ? wh(p.body.position.x, p.body.position.z) : null
          list.push({ t, baseY: +y.toFixed(2), ground: +(gnd===gnd?gnd:0).toFixed(2),
                      water: w!=null ? +w.toFixed(2) : null,
                      dGround: +(y - (gnd===gnd?gnd:0)).toFixed(2),
                      dWater: w!=null ? +(y - w).toFixed(2) : null,
                      sunk: !!p.sunk, inWater: !!p.inWater, asleep: p.body.sleepState === 2,
                      moved: +Math.hypot(p.body.position.x - x, p.body.position.z - z).toFixed(1) })
        }
      }
      grab(res.land, sp.x + 1.5, sp.z + 1.5, false)
      if (wpt) grab(res.water, wpt.x, wpt.z, true)
      for (const p of made) g.physics.removeProp(p)
      return res
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=buoy2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
