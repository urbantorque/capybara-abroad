async page => {
  // T4d: the resting lens on the real loop at rung 1, the sky in the flood
  // live and flagged, read by eye. pf 1 pins the governor; perfRung is ours.
  const PORT = 5194
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome && window.__capy.biome.current === 'pantanal'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'pantanal') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('pantanal') }); await page.waitForTimeout(11000)
    }
  }
  await page.evaluate(() => { const g = window.__capy; g.state.perfRung = 1; g.state.noPanSkyFresnel = false })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'qa/ten-t4d-look-r1.png' })
  await page.evaluate(() => { window.__capy.state.noPanSkyFresnel = true })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/ten-t4d-look-r1cut.png' })
  await page.evaluate(() => { const g = window.__capy; g.state.noPanSkyFresnel = false; g.state.perfRung = 0 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/ten-t4d-look-r0.png' })
}
