async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = {}
  for (const bio of ['kyoto','cali','rio']) {
    await page.evaluate((b) => { const g = window.__capy; g.biome.switchTo(b); g.state.lastError = null }, bio)
    await page.waitForTimeout(4000)
    out[bio] = await page.evaluate(() => {
      const g = window.__capy
      return { err: g.state.lastError || null, t: +g.state.time.toFixed(1) }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4smoke.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
