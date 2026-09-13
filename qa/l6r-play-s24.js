async page => {
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'qa/l6r-play-52.png' })
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button')].filter(e => /Choose a place/i.test(e.textContent))
    for (const e of els) { const b = e.getBoundingClientRect(); if (b.width > 0) return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
    return null
  })
  if (r) await page.mouse.click(r.x, r.y)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l6r-play-53.png' })
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s24.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r)
}
