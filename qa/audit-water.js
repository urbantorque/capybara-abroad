async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','kyoto','cali','rio','iceland','drift','venice','kowloon','palawan','manly','pantanal','cave','antarctic']
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
        sydney:[-80,80,-44,76], quay:[-150,290,-300,70], kyoto:[-100,60,-70,215],
        cali:[-135,130,-110,70], iceland:[-120,130,-210,150], drift:[-110,110,-180,60],
        venice:[-160,60,-80,60], kowloon:[-60,60,-170,70], palawan:[-80,80,-145,70],
        rio:[-110,120,-70,100], manly:[-110,120,-90,90], pantanal:[-130,130,-130,110],
        cave:[-80,80,-200,80], antarctic:[-212,212,-300,122]
      }[name]
      const api = name === 'sydney' ? g.env : g[name]
      const terrF = api.terrainHeight ? api.terrainHeight.bind(api) : null
      const overF = api.isOverWater ? api.isOverWater.bind(api) : null
      const whF = api.waterHeightAt ? api.waterHeightAt.bind(api) : null
      if (!overF) return null
      const N = 40
      const res = new CANNON.RaycastResult()
      let walkable = 0, wet = 0, dry = 0, hole = 0
      const wex = [], hex = []
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = B[0] + (B[1]-B[0])*(i+0.5)/N, z = B[2] + (B[3]-B[2])*(j+0.5)/N
        const w = whF ? whF(x, z) : -0.5
        const o = overF(x, z)
        let t = terrF ? terrF(x, z) : 0; if (!(t===t)) t = 0
        if (o) {
          wet++
          res.reset()
          g.world.raycastClosest(new CANNON.Vec3(x, w + 4, z), new CANNON.Vec3(x, w + 0.05, z), { skipBackfaces:false }, res)
          if (res.hasHit) { walkable++; if (wex.length < 8) wex.push({x:Math.round(x),z:Math.round(z),top:+res.hitPointWorld.y.toFixed(2),w:+w.toFixed(2)}) }
        } else {
          dry++
          if (t < w - 0.6) { hole++; if (hex.length < 8) hex.push({x:Math.round(x),z:Math.round(z),t:+t.toFixed(2),w:+w.toFixed(2)}) }
        }
      }
      return { wet, dry, walkableWater: walkable, dryBelowWater: hole, wex, hex }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=water3.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
