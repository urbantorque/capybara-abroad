async page => {
  const click = async (re) => {
    const r = await page.evaluate((src) => {
      const re = new RegExp(src, 'i')
      const els = [...document.querySelectorAll('button, li, a, div, span')].filter(e => re.test(e.textContent.trim()) && e.children.length <= 3)
      for (const e of els.reverse()) { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (b.width > 0 && +cs.opacity > 0.5 && cs.visibility !== 'hidden') return { x: b.x + b.width / 2, y: b.y + b.height / 2, t: e.textContent.trim().slice(0, 40) } }
      return null
    }, re)
    if (r) await page.mouse.click(r.x, r.y)
    return r
  }
  const log = []
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  log.push(await click('^quit to the title$'))
  await page.waitForTimeout(1000)
  log.push(await click('^quit to the title$'))
  await page.waitForTimeout(5000)
  log.push(await click('^Go somewhere else'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l6r-play-73.png' })
  log.push(await click('^Sơn Đoòng'))
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
  out.log = log
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s32.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
