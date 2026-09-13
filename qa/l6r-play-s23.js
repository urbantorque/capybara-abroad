async page => {
  const clickVis = async (re) => {
    const r = await page.evaluate((src) => {
      const re = new RegExp(src, 'i')
      const els = [...document.querySelectorAll('button, li, a, div, span')].filter(e => re.test(e.textContent.trim()) && e.children.length <= 2)
      for (const e of els.reverse()) { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (b.width > 0 && +cs.opacity > 0.5 && cs.visibility !== 'hidden') return { x: b.x + b.width / 2, y: b.y + b.height / 2, t: e.textContent.trim().slice(0, 40) } }
      return null
    }, re)
    if (r) await page.mouse.click(r.x, r.y)
    return r
  }
  const log = []
  log.push(await clickVis('^quit to the title$'))
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/l6r-play-50.png' })
  log.push(await clickVis('^Choose a place$'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l6r-play-51.png' })
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s23.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
