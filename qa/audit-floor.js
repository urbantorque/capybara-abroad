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
      const g = window.__capy, CANNON = g.CANNON
      const B = {
        sydney:[-80,80,-44,76], quay:[-150,290,-600,70], pasto:[-115,115,-115,115],
        kyoto:[-100,60,-70,215], cali:[-135,130,-110,70], iceland:[-120,130,-210,150],
        sahara:[-90,350,-110,100], drift:[-110,110,-180,60], venice:[-160,60,-80,60],
        kowloon:[-60,60,-170,70], palawan:[-80,80,-145,70], goreme:[-90,110,-120,70],
        rio:[-110,120,-70,100], manly:[-110,120,-90,90], pantanal:[-130,130,-130,110],
        cave:[-80,80,-200,80], antarctic:[-212,212,-500,122]
      }[name]
      const api = name === 'sydney' ? g.env : g[name]
      const terrF = api && api.terrainHeight ? api.terrainHeight.bind(api) : null
      const overF = api && api.isOverWater ? api.isOverWater.bind(api) : null
      const N = 34
      let noHit = 0, tested = 0, water = 0
      const gaps = []
      const worst = []
      const res = new CANNON.RaycastResult()
      const from = new CANNON.Vec3(), to = new CANNON.Vec3()
      const opt = { collisionFilterMask: -1, skipBackfaces: false }
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = B[0] + (B[1]-B[0]) * (i+0.5)/N
        const z = B[2] + (B[3]-B[2]) * (j+0.5)/N
        if (overF && overF(x, z)) { water++; continue }
        const t = terrF ? terrF(x, z) : 0
        if (!(t === t)) continue
        tested++
        res.reset()
        from.set(x, t + 2.5, z); to.set(x, t - 8, z)
        g.world.raycastClosest(from, to, opt, res)
        if (!res.hasHit) { noHit++; continue }
        const d = res.hitPointWorld.y - t
        gaps.push(d)
        worst.push({ x: Math.round(x), z: Math.round(z), d: +d.toFixed(2), t: +t.toFixed(2) })
      }
      gaps.sort((a,b)=>a-b)
      worst.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))
      const q = p => gaps.length ? +gaps[Math.min(gaps.length-1, Math.floor(p*gaps.length))].toFixed(2) : null
      const above = gaps.filter(v => v > 0.5).length, below = gaps.filter(v => v < -0.5).length
      return { tested, water, noHit, hits: gaps.length,
               p05: q(0.05), p50: q(0.5), p95: q(0.95), min: q(0), max: gaps.length?+gaps[gaps.length-1].toFixed(2):null,
               above05: above, below05: below, worst: worst.slice(0,6) }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=floor3.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
