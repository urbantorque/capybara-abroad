async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('rio')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const r = []
    for (const b of g.world.bodies) {
      if (b.mass > 0) continue
      let hf = false
      for (const s of b.shapes) if (s.constructor && s.constructor.name === 'Heightfield') hf = true
      if (hf) continue
      b.updateAABB()
      const lo = b.aabb.lowerBound, hi = b.aabb.upperBound
      if (hi.z < 20 || lo.z > 60) continue
      r.push({ bb: [Math.round(lo.x), Math.round(lo.y), Math.round(lo.z), Math.round(hi.x), Math.round(hi.y), Math.round(hi.z)],
               ud: b.userData ? Object.keys(b.userData).join(',') : '', shapes: b.shapes.length, type: b.type })
    }
    return { n: g.world.bodies.length, r }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=y67bodies.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
