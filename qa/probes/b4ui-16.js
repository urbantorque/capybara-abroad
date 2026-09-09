async page => {
  await page.keyboard.press('KeyJ')
  await page.waitForTimeout(1200)
  await page.evaluate(async () => { await fetch('/shot?name=b4ui-16.json', { method: 'POST', body: btoa('ok') }) })
}
