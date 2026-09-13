async page => {
  const pos = async () => page.evaluate(() => { const p = window.__capy.capy.body.position; return [p.x, p.y, p.z].map(v => +v.toFixed(2)) })
  const log = []
  log.push(['before', await pos()])
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(1500)
  log.push(['E 1.5s', await pos()])
  await page.screenshot({ path: 'qa/l7r-play-51.png' })
  await page.waitForTimeout(1500)
  log.push(['E 3s', await pos()])
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(2000)
  log.push(['released +2s', await pos()])
  await page.screenshot({ path: 'qa/l7r-play-52.png' })
  const vis = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim()).slice(-25))
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s26.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { log, vis })
}
