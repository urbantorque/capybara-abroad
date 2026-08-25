async page => {
  const out = {}
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(800)
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  out.a = await page.evaluate(() => {
    const c = document.querySelector('.capyui-jrcard')
    const leg = document.querySelector('details.capyui-jrkeys')
    const last = document.querySelector('details.capyui-jrkeys .capyui-legend > *:last-child')
    const foot = document.querySelector('.capyui-jrfoot')
    const rr = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    return { cardRect: rr(c), scrollTop: c.scrollTop, scrollH: c.scrollHeight, clientH: c.clientHeight,
             detOpen: leg ? leg.open : null, legRect: rr(last), footRect: rr(foot),
             sb: getComputedStyle(c).scrollBehavior, footInDom: !!foot, footTxt: foot ? foot.textContent.slice(0, 40) : null }
  })
  out.b = await page.evaluate(() => {
    const c = document.querySelector('.capyui-jrcard')
    c.scrollTop = c.scrollHeight
    const last = document.querySelector('details.capyui-jrkeys .capyui-legend > *:last-child')
    const foot = document.querySelector('.capyui-jrfoot')
    const rr = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    return { scrollTop: c.scrollTop, legRect: rr(last), footRect: rr(foot), cardBottom: Math.round(c.getBoundingClientRect().bottom) }
  })
  // and does WHEEL scrolling reach it (the real player gesture)?
  await page.mouse.move(960, 540)
  await page.evaluate(() => { const c = document.querySelector('.capyui-jrcard'); c.scrollTop = 0 })
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(500)
  out.wheel = await page.evaluate(() => { const c = document.querySelector('.capyui-jrcard'); return { scrollTop: c.scrollTop } })
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-9.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
