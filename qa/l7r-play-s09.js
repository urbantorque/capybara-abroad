async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'qa/l7r-play-18.png' })
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 600))
  await page.evaluate((t) => fetch('/shot?name=l7r-play-s09.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify({ t: Date.now(), txt: t })))) }), txt)
}
