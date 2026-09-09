async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const before = { cur: g.biome.current, hasManly: !!g.manly }
    g.biome.switchTo('manly')
    // immediately after the switch: where did the props land?
    const snap = []
    for (const p of (g.props||[])) {
      if (p.biome !== 'manly' || !p.body) continue
      snap.push([+p.body.position.x.toFixed(1), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(1),
                 +g.manly.terrainHeight(p.body.position.x, p.body.position.z).toFixed(2)])
    }
    // cannon raycast straight down at one of them
    const CANNON = g.CANNON
    const res = new CANNON.RaycastResult()
    let ray = null
    if (snap.length) {
      const s = snap[0]
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(s[0], 12, s[2]), new CANNON.Vec3(s[0], -8, s[2]), {}, res)
      ray = res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null
    }
    await new Promise(r=>setTimeout(r,3000))
    const after = []
    for (const p of (g.props||[])) {
      if (p.biome !== 'manly' || !p.body) continue
      after.push([+p.body.position.x.toFixed(1), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(1)])
    }
    return { before, n: snap.length, snap: snap.slice(0,6), ray, after: after.slice(0,6) }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fmdiag.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
