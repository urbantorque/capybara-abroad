async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('quay')
  })
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy, q = g.quay
    const r = { }
    r.water = {
      brad: q.isOverWater(-76,-196), north: q.isOverWater(236,-498),
      pylon: q.isOverWater(-59,-63), middle: q.isOverWater(-122,-404),
      manlyW: q.isOverWater(44,-572), fairway: q.isOverWater(30,-200),
      berth: q.isOverWater(6.6, 6),
    }
    r.terr = { brad: q.terrainHeight(-76,-196), fort: q.terrainHeight(6,-126), fairway: q.terrainHeight(30,-200) }
    // count static bodies overlapping brad + pylon now
    let nb = 0, np = 0
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
      b.updateAABB()
      const lo=b.aabb.lowerBound, hi=b.aabb.upperBound
      if (!(lo.x===lo.x)) continue
      if (lo.x<-70&&hi.x>-82&&lo.z<-190&&hi.z>-202) nb++
      if (lo.x<-55&&hi.x>-63&&lo.z<-58&&hi.z>-68) np++
    }
    r.bodiesBrad = nb; r.bodiesPylon = np
    return r
  })
  // now drive the boat at Bradleys Head using the internal state
  const drive = await page.evaluate(async () => {
    const g = window.__capy, q = g.quay
    const log = []
    // teleport the capy to the helm and take it
    const seq = []
    // fake: directly step the boat by simulating input
    const inp = g.input
    // put the animal at the helm
    const h = q.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z - 1)
    g.capy.body.velocity.set(0,0,0)
    for (let i=0;i<10;i++) g.tick(1/60,false)
    inp.actionPressed = true; g.tick(1/60,false); inp.actionPressed = false
    log.push('atHelm=' + q.boat.atHelm)
    // aim at Bradleys Head (-76,-196) from berth (6.6,6): full ahead, steer
    for (let f=0; f<3600; f++) {
      const bx = q.boat.position.x, bz = q.boat.position.z
      const want = Math.atan2(-76-bx, -196-bz)
      let d = want - q.boat.heading
      while (d>Math.PI) d-=Math.PI*2
      while (d<-Math.PI) d+=Math.PI*2
      inp.z = -1                     // throttle up
      inp.x = Math.max(-1, Math.min(1, -d*2))
      g.tick(1/60,false)
      if (f%600===0) log.push(f+': ('+bx.toFixed(0)+','+bz.toFixed(0)+') sp='+q.boat.speed.toFixed(1))
      if (Math.hypot(bx+76, bz+196) < 40) break
    }
    inp.z = 0; inp.x = 0
    for (let f=0;f<240;f++) g.tick(1/60,false)
    log.push('final ('+q.boat.position.x.toFixed(1)+','+q.boat.position.z.toFixed(1)+') dist='+Math.hypot(q.boat.position.x+76,q.boat.position.z+196).toFixed(1))
    return log
  })
  out.drive = drive
  await page.evaluate((o) => fetch('/shot?name=s2boat.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
