async page => {
  const b = await page.$('text=Begin')
  await b.click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l6r-play-02.png' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6r-play-03.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    const vis = [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
    }).map(e => e.textContent.trim())
    return { started: g && g.state.started, biome: g && g.biome.current, vis, err: g && g.state.lastError }
  })
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s02.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
