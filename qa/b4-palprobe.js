async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const A = g.palawan, b = g.capy.body
    const x = 0, z = -18
    const ty = A.terrainHeight(x, z)
    const wy = A.waterHeightAt ? A.waterHeightAt(x, z) : 0
    b.position.set(x, ty + 0.5, z); b.velocity.set(0,0,0)
    for (let i = 0; i < 200; i++) g.tick(1/60, false)
    return { terrain: +ty.toFixed(2), water: +wy.toFixed(2),
             capyY: +g.capy.position.y.toFixed(2),
             diving: !!g.capy.diving, depth: +(g.capy.depth||0).toFixed(2),
             swimming: !!g.capy.swimming,
             canDive: A.canDive === undefined ? 'measured' : A.canDive }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4-palprobe.json',{method:'POST',body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
