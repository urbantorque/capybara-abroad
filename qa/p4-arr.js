async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('KEYSTUB')
  await page.waitForTimeout(11000)
  const info = await page.evaluate(() => {
    const g = window.__capy, api = g[g.biome.current]
    return { bio: g.biome.current, capy: [g.capy.position.x,g.capy.position.y,g.capy.position.z].map(v=>+v.toFixed(1)),
             terr: +api.terrainHeight(g.capy.position.x, g.capy.position.z).toFixed(2),
             cam: [g.camera.position.x,g.camera.position.y,g.camera.position.z].map(v=>+v.toFixed(1)),
             err: g.state.lastError || null }
  })
  const b = await page.screenshot({ type: 'png' })
  await page.evaluate(async (a) => { await fetch('/shot?name=' + a.n, { method: 'POST', body: a.d }) }, { n: 'NAMESTUB', d: 'data:image/png;base64,' + b.toString('base64') })
  await page.evaluate(async (o) => { await fetch('/shot?name=NAMESTUB.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, info)
}
