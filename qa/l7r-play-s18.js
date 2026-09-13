async page => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l7r-play-33.png' })
  const btn = await page.$('text=the journey so far')
  if (btn) await btn.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-play-34.png' })
  const vis = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim()).slice(0, 60))
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s18.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), vis)
}
