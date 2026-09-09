async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Comma')
  await page.waitForTimeout(700)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(6000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    return { biome: g.biome.current, started: g.state.started,
             arrival: g.hud.isTaskDone('to-antarctic'),
             at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
             err: g.state.lastError || null, saves: g.state.solverSaves || 0 }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=antstart.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, r)
}
