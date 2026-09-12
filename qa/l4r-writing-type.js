async page => {
  // computed font sizes of the HUD text at the review viewport
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(4000)
  const begin = await page.$('text=Begin'); const carry = await page.$('text=Carry on')
  if (carry) await carry.click(); else if (begin) await begin.click()
  await page.waitForTimeout(4000)
  const out = await page.evaluate(() => {
    const pick = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { sel, px: cs.fontSize, color: cs.color, weight: cs.fontWeight, text: (e.textContent || '').trim().slice(0, 40) } }
    return ['.capyui-part', '.capyui-kick', '.capyui-task', '.capyui-clue', '.capyui-count', '.capyui-finds', '.capyui-toast', '.capyui-pips', '.capyui-maplbl', '.capyui-mapdist', '.capyui-bubble', '.capyui-way', '.capyui-tab'].map(pick).filter(Boolean)
      .concat([{ vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, t: getComputedStyle(document.documentElement).getPropertyValue('--capyui-t') }])
  })
  await page.evaluate((o) => fetch('/shot?name=l4r-writing-type.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
