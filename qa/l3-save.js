async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const btn = await page.$('.capyui-pausebtn:not(.go):not(.small)')
  const settings = await page.evaluate(() => { const bs = Array.from(document.querySelectorAll('.capyui-pausebtn')); const b = bs.find(x => /settings/i.test(x.textContent)); if (b) b.click(); return bs.map(x => x.textContent) })
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const row = document.querySelector('.capyui-setsave')
    if (row) row.scrollIntoView()
    return { has: !!row, btns: row ? Array.from(row.querySelectorAll('button')).map(b => b.textContent) : null }
  })
  await page.screenshot({ path: 'qa/l3-save.png' })
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l3-save.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { settings, r, err })
}
