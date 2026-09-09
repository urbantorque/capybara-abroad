async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { issues: [] }
    g.biome.switchTo('cave')
    const sp = g.biome.spawnOf('cave'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    for (let i = 0; i < 120; i++) g.tick(1/60, false)
    const A = g.cave
    const P = (x,z) => +A.surfacePitch(x, z, 1).toFixed(2)
    R.surf = { outside: P(0, A.mouth ? A.mouth.z + 20 : 60), doline: P(A.doline.x, A.doline.z),
               river: P(A.river.x, 20), roost: P(A.roost.x, A.roost.z),
               wall: P(0, A.wall.z), deep: P(0, -86) }
    const seen = {}
    for (let x=-60;x<=60;x+=3) for (let z=-160;z<=60;z+=3) {
      if (A.isOverWater && A.isOverWater(x,z)) continue
      const v=P(x,z); seen[v]=(seen[v]||0)+1
    }
    R.hist = seen
    R.err = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async o => { await fetch('/shot?name=b4-cavfix.json',{method:'POST',body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
