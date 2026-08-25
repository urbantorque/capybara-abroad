async page => {
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    const sp = g.biome.spawnOf('pantanal'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    for (let i = 0; i < 200; i++) g.tick(1/60, false)
  })
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)))
}
