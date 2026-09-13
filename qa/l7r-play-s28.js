async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim())
      const p = g.capy.body.position
      return { t: Date.now(), biome: g.biome.current, pos: [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-34), err: g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyD')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(300)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l7r-play-57.png' })
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(600)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(800)
  await page.keyboard.up('KeyW')
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-play-58.png' })
  await dump('l7r-play-s28.json')
}
