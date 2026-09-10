async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  const before = await page.evaluate(() => ({
    started: !!window.__capy.state.started,
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.className + '|' + b.textContent.slice(0, 24)),
  }))
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-go')
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  const afterBtn = await page.evaluate(() => !!window.__capy.state.started)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  const afterEnter = await page.evaluate(() => !!window.__capy.state.started)
  const out = { before, afterBtn, afterEnter }
  await page.evaluate(o => fetch('/shot?name=start.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
