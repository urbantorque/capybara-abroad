async page => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l6r-play-42.png' })
  const info = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => /^settings$/i.test(e.textContent.trim()))
    return els.map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { tag: e.tagName, cls: e.className, w: r.width, op: cs.opacity, vis: cs.visibility, x: r.x, y: r.y } })
  })
  const v = info.find(i => i.w > 0 && +i.op > 0.5 && i.vis !== 'hidden')
  if (v) {
    await page.mouse.click(v.x + 20, v.y + 8)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'qa/l6r-play-43.png' })
  }
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s19.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), info)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l6r-play-44.png' })
}
