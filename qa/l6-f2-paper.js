async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { window.__capy.completeTask('acrobats', true); window.__capy.hud.cross('sahara') })
  await page.waitForTimeout(9000)
  let found = false
  for (let k = 0; k < 16 && !found; k++) {
    await page.keyboard.press('KeyF'); await page.waitForTimeout(700)
    found = await page.evaluate(() => document.body.innerText.includes('off a wall'))
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l6-f2-paper.png' })
  await page.evaluate(o => fetch('/shot?name=l6-f2-paper.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { found })
}
