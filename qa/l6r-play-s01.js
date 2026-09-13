async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6r-play-01.png' })
  const txt = await page.evaluate(() => document.body.innerText)
  await page.evaluate((t) => fetch('/shot?name=l6r-play-s01.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify({ t: Date.now(), txt: t })))) }), txt)
}
