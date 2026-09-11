async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.screenshot({ path: 'qa/l3-title.png' })
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  await page.screenshot({ path: 'qa/l3-paper.png', clip: { x: 0, y: 0, width: 320, height: 420 } })
  const t = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-way')).map(e => e.textContent + ' | ' + e.className))
  await page.evaluate((o) => fetch('/shot?name=l3-title.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), t)
}
