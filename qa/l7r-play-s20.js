async page => {
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Venice')
    const e = els[0]
    if (!e) return 'none'
    let n = e; for (let i = 0; i < 4 && n && n.tagName !== 'BUTTON'; i++) n = n.parentElement
    const target = (n && n.tagName === 'BUTTON') ? n : e
    target.click(); return target.tagName + ' ' + target.className
  })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-play-35.png' })
  await page.waitForTimeout(7000)
  await page.screenshot({ path: 'qa/l7r-play-36.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    const vis = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim())
    const p = g.capy.body.position
    return { biome: g.biome.current, pos: [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-40), err: g.state.lastError }
  })
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s20.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { r, out })
}
