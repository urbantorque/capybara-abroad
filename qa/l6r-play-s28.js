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
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l6r-play-60.png' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'qa/l6r-play-61.png' })
  await page.waitForTimeout(2000)
  await page.keyboard.up('KeyW')
  await page.screenshot({ path: 'qa/l6r-play-62.png' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l6r-play-63.png' })
  await dump('l6r-play-s28.json')
}
