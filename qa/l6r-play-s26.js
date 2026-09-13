async page => {
  await page.mouse.click(380, 620)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l6r-play-55.png' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6r-play-56.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    const vis = [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
    }).map(e => e.textContent.trim())
    const p = g.capy && g.capy.body ? g.capy.body.position : null
    return { t: Date.now(), started: g.state.started, biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-45), err: g.state.lastError }
  })
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s26.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
