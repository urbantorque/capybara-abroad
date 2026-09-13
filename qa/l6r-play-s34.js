async page => {
  await page.mouse.move(640, 600)
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l6r-play-77.png' })
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => /^Sơn Đoòng$/.test(e.textContent.trim()))
    return els.map(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, cls: e.className, w: b.width } })
  })
  const c = r.find(e => e.w > 0 && e.y < 760 && e.y > 0 && /jr|card|pick|chap/i.test(e.cls)) || r.find(e => e.w > 0 && e.y < 760)
  if (c) await page.mouse.click(c.x, c.y)
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
  out.r = r; out.c = c
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s34.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
