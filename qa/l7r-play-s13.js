async page => {
  const pos = async () => page.evaluate(() => { const p = window.__capy.capy.body.position; return [p.x, p.y, p.z].map(v => +v.toFixed(2)) })
  const log = []
  log.push(['start', await pos()])
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); log.push([(i + 1) * 250, await pos()]) }
  await page.keyboard.up('KeyW')
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(150); log.push(['stop+' + (i + 1) * 150, await pos()]) }
  await page.screenshot({ path: 'qa/l7r-play-23.png' })
  const vis = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim()).slice(-12))
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s13.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { log, vis })
}
