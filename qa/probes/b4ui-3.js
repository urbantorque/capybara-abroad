async page => {
  const out = { tabOrder: [], start: null, photo: null }
  // --- tab order on the title card ---
  await page.evaluate(() => { document.body.focus() })
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const a = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { tag: el.tagName, c: (typeof el.className === 'string' && el.className) || '', t: (el.textContent || '').trim().slice(0, 26), w: Math.round(b.width), h: Math.round(b.height) }
    })
    out.tabOrder.push(a)
  }
  // --- start ---
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  out.start = await page.evaluate(() => ({ started: !!(window.__capy && window.__capy.state && window.__capy.state.started), active: document.activeElement && document.activeElement.tagName }))
  if (!out.start.started) {
    await page.mouse.click(640, 400)
    await page.waitForTimeout(2500)
    out.start.afterClick = await page.evaluate(() => !!(window.__capy && window.__capy.state && window.__capy.state.started))
  }
  await page.waitForTimeout(2500)
  // --- take a photo so the album exists ---
  await page.keyboard.press('k'); await page.waitForTimeout(1200)
  const inPhoto = await page.evaluate(() => document.querySelectorAll('[class*="capyui-pm"],[class*="capyui-shot"]').length)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  await page.keyboard.press('k'); await page.waitForTimeout(900)
  await page.keyboard.press('j'); await page.waitForTimeout(900)
  out.photo = await page.evaluate(() => {
    const bs = Array.from(document.querySelectorAll('button.capyui-jrled'))
    return { inPhotoEls: 0, buttons: bs.map(b => ({ t: b.textContent.trim().slice(0, 30), hidden: b.hasAttribute('hidden'), disp: getComputedStyle(b).display })) }
  })
  out.photo.inPhotoEls = inPhoto
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
