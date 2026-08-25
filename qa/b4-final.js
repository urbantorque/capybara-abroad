async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  // walk about a bit with real keys, so the HUD, the paper and the world all run
  for (const k of ['w','w','d','q','w','a','s']) {
    await page.keyboard.down(k); await page.waitForTimeout(420); await page.keyboard.up(k)
  }
  await page.waitForTimeout(1200)
  await page.keyboard.press('j'); await page.waitForTimeout(1200)
  const st = await page.evaluate(() => ({ err: window.__capy.state.lastError || null,
                                          biome: window.__capy.biome.current }))
  await page.evaluate(async o => { await fetch('/shot?name=b4-final.json',{method:'POST',body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, { st, errs })
}
