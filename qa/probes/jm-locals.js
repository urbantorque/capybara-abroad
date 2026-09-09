async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const res = {}
    for (const bn of ['cave','antarctic']) {
      g.biome.switchTo(bn)
      for(let i=0;i<200;i++) g.tick(1/60,false)
      const api = g.npcs && g.npcs.length ? null : null
      res[bn] = { err: g.state.lastError || null }
    }
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jm.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
