async page => {
  await page.screenshot({ path: 'qa/l6r-play-73.png' })
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, li, a, div')].filter(e => /^Sơn Đoòng/.test(e.textContent.trim()) && e.children.length <= 3)
    const e = els[els.length - 1]
    if (!e) return null
    e.scrollIntoView({ block: 'center' })
    const b = e.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, t: e.textContent.trim().slice(0, 40), cls: e.className }
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/l6r-play-76.png' })
  if (r) await page.mouse.click(r.x, r.y)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l6r-play-74.png' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6r-play-75.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    const vis = [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
    }).map(e => e.textContent.trim())
    const p = g.capy && g.capy.body ? g.capy.body.position : null
    return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-40), err: g.state.lastError }
  })
  out.r = r
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s33.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
