async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  const s1 = await page.evaluate(() => ({ started: window.__capy.state.started, bio: window.__capy.biome.current, t: window.__capy.state.time }))
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const s2 = await page.evaluate(() => ({ started: window.__capy.state.started, bio: window.__capy.biome.current, t: +window.__capy.state.time.toFixed(2) }))
  await page.keyboard.press('Digit6')
  await page.waitForTimeout(4000)
  const s3 = await page.evaluate(() => ({ started: window.__capy.state.started, bio: window.__capy.biome.current, t: +window.__capy.state.time.toFixed(2) }))
  await page.evaluate(() => { window.__capy.biome.switchTo('rio') })
  await page.waitForTimeout(4000)
  const s4 = await page.evaluate(() => ({ bio: window.__capy.biome.current, t: +window.__capy.state.time.toFixed(2),
    p: window.__capy.capy.position.toArray().map(v => +v.toFixed(1)) }))
  await page.evaluate(async o => {
    await fetch('/shot?name=p3r-diag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { s1, s2, s3, s4 })
}
