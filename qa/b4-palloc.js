async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const b = g.capy.body; const sp = g.biome.spawnOf('palawan')
    b.position.set(sp.x, sp.y, sp.z)
    for (let i = 0; i < 120; i++) g.tick(1/60, false)
    const A = g.palawan
    const pts = { fire:[4.5,55], netman:[-4.5,52], drying:[16,52.5], painter:[22,49],
                  boatman:[5.3,16], boy:[6.6,17] }
    const R = { ground: {}, pairs: {} }
    for (const k in pts) R.ground[k] = +A.terrainHeight(pts[k][0], pts[k][1]).toFixed(2)
    const d=(a,b2)=>+Math.hypot(pts[a][0]-pts[b2][0], pts[a][1]-pts[b2][1]).toFixed(1)
    R.pairs = { 'fire-netman': d('fire','netman'), 'drying-painter': d('drying','painter'),
                'boatman-boy': d('boatman','boy') }
    R.surfBangka = null
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4-palloc.json',{method:'POST',body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
