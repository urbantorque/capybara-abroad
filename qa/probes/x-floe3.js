async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
  })
  const out = { chunks: [] }
  for (let c = 0; c < 7; c++) {
    const r = await page.evaluate(() => {
      const g = window.__capy
      const t = performance.now()
      while (performance.now() - t < 12000) g.tick(1/30,false)
      const zs = []
      for (const b of g.world.bodies) {
        if (b.type !== g.CANNON.Body.KINEMATIC) continue
        if (!b.shapes[0] || b.shapes[0].constructor.name !== 'Cylinder') continue
        zs.push(Math.round(b.position.z))
      }
      return { t: Math.round(g.state.time), zs, bad: zs.filter(z => z > 130 || z < -520).length }
    })
    out.chunks.push(r)
  }
  out.worstBad = Math.max.apply(null, out.chunks.map(c => c.bad))
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xfloe3.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
