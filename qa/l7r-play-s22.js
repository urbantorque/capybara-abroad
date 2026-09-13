async page => {
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'qa/l7r-play-40.png' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l7r-play-41.png' })
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(500)
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l7r-play-42.png' })
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-play-43.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    const vis = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim())
    const p = g.capy.body.position
    return { biome: g.biome.current, pos: [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-30), err: g.state.lastError }
  })
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s22.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
