async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g && g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), started: g && g.state.started, biome: g && g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-50), err: g && g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-play-02.png' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l7r-play-03.png' })
  await dump('l7r-play-s02.json')
}
