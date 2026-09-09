async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const R = {}
    const grab = () => {
      const zs = []
      for (const b of g.world.bodies) {
        if (b.type !== g.CANNON.Body.KINEMATIC) continue
        if (!b.shapes[0] || b.shapes[0].constructor.name !== 'Cylinder') continue
        zs.push(Math.round(b.position.z))
      }
      return zs
    }
    for (let i=0;i<300;i++) g.tick(1/60,false)
    R.t0 = grab()
    // twelve minutes of sim, which is long enough for every pan to reach the shelf
    for (let i=0;i<6*60*60;i++) g.tick(1/45,false)
    R.t12 = grab()
    R.outOfWorld = R.t12.filter(z => z > 130 || z < -520).length
    return R
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xfloe.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
