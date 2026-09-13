async page => {
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, div, span')].filter(e => /journey so far/i.test(e.textContent) && e.children.length === 0)
    const e = els[0]
    if (e) { e.click(); return e.tagName + ' ' + e.className }
    return 'none'
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-play-34.png' })
  const vis = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim()).slice(0, 80))
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s19.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { r, vis })
}
