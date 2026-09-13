async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-30), err: g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  await page.keyboard.press('Space')
  await page.waitForTimeout(220)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'qa/l6r-play-57.png' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l6r-play-58.png' })
  await dump('l6r-play-s27a.json')
  await page.keyboard.down('KeyW')
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyD')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'qa/l6r-play-59.png' })
  await dump('l6r-play-s27.json')
}
