async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const B = {
    sydney:[-80,80,-44,76], quay:[-150,290,-600,70], pasto:[-115,115,-115,115],
    kyoto:[-100,60,-70,215], cali:[-135,130,-110,70], iceland:[-120,130,-210,150],
    sahara:[-90,350,-110,100], drift:[-110,110,-180,60], venice:[-160,60,-80,60],
    kowloon:[-60,60,-170,70], palawan:[-80,80,-145,70], goreme:[-90,110,-120,70],
    rio:[-110,120,-70,100], manly:[-110,120,-90,90], pantanal:[-130,130,-130,110],
    cave:[-80,80,-200,80], antarctic:[-212,212,-500,122]
  }
  const out = {}
  for (const n of Object.keys(B)) {
    out[n] = await page.evaluate(async (q) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      const name = q.name, b = q.b
      g.biome.switchTo(name); await sleep(700)
      const api = g[name] || (name === 'sydney' ? g.env : null)
      const terrF = api && api.terrainHeight ? api.terrainHeight.bind(api) : null
      const waterF = api && api.isOverWater ? api.isOverWater.bind(api) : null
      const slopeF = api && api.slopeAt ? api.slopeAt.bind(api) : null
      const STEP = 4
      let cells = 0, land = 0, flat = 0
      for (let x = b[0]; x <= b[1]; x += STEP) {
        for (let z = b[2]; z <= b[3]; z += STEP) {
          cells++
          if (waterF && waterF(x, z)) continue
          const h = terrF ? terrF(x, z) : 0
          if (!(h === h)) continue
          land++
          const s = slopeF ? slopeF(x, z) : 0
          if (s === s && s < 0.75) flat++
        }
      }
      return { cells, land, flat, cellArea: STEP * STEP,
               boxArea: (b[1]-b[0]) * (b[3]-b[2]),
               landArea: land * STEP * STEP, flatArea: flat * STEP * STEP }
    }, { name: n, b: B[n] })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=area.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
