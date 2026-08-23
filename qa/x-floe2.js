async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const R = { t0: g.state.time }
    const f = () => g.antarctic.nearestFloe()
    R.z0 = Math.round(g.antarctic.seal().z)
    const t = performance.now()
    let n = 0
    while (n < 40000 && performance.now() - t < 14000) { g.tick(1/30,false); n++ }
    R.n = n
    R.simSeconds = +(g.state.time - R.t0).toFixed(1)
    R.z1 = Math.round(g.antarctic.seal().z)
    R.wall = Math.round(performance.now() - t)
    return R
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xfloe2.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
