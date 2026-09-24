async page => {
  // T2b: what is on screen after crossing to the Antarctic (a diagnosis shot)
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5192/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  for (let i = 0; i < 3; i++) { const cur = await page.evaluate(() => window.__capy.biome.current); if (cur === 'antarctic') break; await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('antarctic') }); await page.waitForTimeout(12000) }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  await page.waitForTimeout(12000)
  const o = await page.evaluate(() => { const g = window.__capy; return { cur: g.biome.current, t: g.state.time, paused: g.state.paused, started: g.state.started, mode: g.state.journeyMode, rung: g.state.perfRung, err: g.state.lastError || null, hidden: document.hidden } })
  await page.waitForTimeout(2000)
  o.t2 = await page.evaluate(() => window.__capy.state.time)
  await page.screenshot({ path: 'qa/ten-t2b-look.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t2b-look.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, o)
}
