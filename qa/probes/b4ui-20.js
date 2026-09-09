async page => {
  const out = {}
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  out.a = await page.evaluate(() => {
    const c = document.querySelector('.capyui-jrcard')
    const d = document.querySelector('details.capyui-jrkeys')
    const last = document.querySelector('details.capyui-jrkeys .capyui-legend > *:last-child')
    const foot = document.querySelector('.capyui-jrfoot')
    const rr = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    return { detOpen: d.open, scrollTop: c.scrollTop, scrollH: c.scrollHeight, clientH: c.clientHeight,
             cardRect: rr(c), lastRect: rr(last), footRect: rr(foot), padB: getComputedStyle(c).paddingBottom }
  })
  out.b = await page.evaluate(() => {
    const c = document.querySelector('.capyui-jrcard')
    c.scrollTop = 99999
    const last = document.querySelector('details.capyui-jrkeys .capyui-legend > *:last-child')
    const foot = document.querySelector('.capyui-jrfoot')
    const rr = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
    return { scrollTop: c.scrollTop, maxScroll: c.scrollHeight - c.clientHeight, lastRect: rr(last), footRect: rr(foot), cardBottom: Math.round(c.getBoundingClientRect().bottom) }
  })
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  // Escape while the camera is up
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1200)
  out.photoBefore = await page.evaluate(() => window.__capy.hud.photoAudit().on)
  await page.keyboard.press('Escape'); await page.waitForTimeout(900)
  out.afterEsc = await page.evaluate(() => ({ photo: window.__capy.hud.photoAudit().on,
    jr: document.querySelector('.capyui-jr').classList.contains('show'), paused: window.__capy.state.paused }))
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  out.afterEsc2 = await page.evaluate(() => ({ photo: window.__capy.hud.photoAudit().on,
    jr: document.querySelector('.capyui-jr').classList.contains('show'), paused: window.__capy.state.paused }))
  await page.keyboard.press('KeyK'); await page.waitForTimeout(700)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-20.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
