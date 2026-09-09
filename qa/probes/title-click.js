async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = {}
  // 1. a click on the backdrop band that used to be swallowed
  await page.reload(); await page.waitForTimeout(4500)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  out.bandClick = await page.evaluate(() => ({ started: window.__capy.state.started, biome: window.__capy.biome.current }))
  // 2. the summary itself must open the fold and NOT start the game
  await page.reload(); await page.waitForTimeout(4500)
  const box = await page.evaluate(() => {
    const r = document.querySelector('.capyui-more summary').getBoundingClientRect()
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]
  })
  await page.mouse.click(box[0], box[1])
  await page.waitForTimeout(700)
  out.summaryClick = await page.evaluate(() => ({
    started: window.__capy.state.started,
    open: document.querySelector('.capyui-more').open }))
  // 3. the go button turns the page and does not start
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(700)
  out.go = await page.evaluate(() => ({ started: window.__capy.state.started,
    p2: !document.querySelector('.capyui-p2').hidden }))
  // 4. a stray click on the picker backdrop must NOT start anything
  await page.mouse.click(140, 360)
  await page.waitForTimeout(700)
  out.strayOnPage2 = await page.evaluate(() => ({ started: window.__capy.state.started }))
  // 5. escape comes back
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  out.esc = await page.evaluate(() => ({ p1: !document.querySelector('.capyui-p1').hidden,
    started: window.__capy.state.started }))
  // 6. a chapter key from page one goes straight there
  await page.keyboard.press('Digit4'); await page.waitForTimeout(1800)
  out.key4 = await page.evaluate(() => ({ started: window.__capy.state.started, biome: window.__capy.biome.current }))
  await page.evaluate(async (o) => { await fetch('/shot?name=titleclick.json', { method: 'POST', body: btoa(JSON.stringify(o, null, 1)) }) }, out)
}
