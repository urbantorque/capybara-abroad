async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g && g.capy && g.capy.body ? g.capy.body.position : null
      const v = g && g.capy && g.capy.body ? g.capy.body.velocity : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vel: v && [v.x, v.y, v.z].map(v => +v.toFixed(2)), vis: vis.slice(-45), err: g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l7r-play-04.png' })
  await dump('l7r-play-s03a.json')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'qa/l7r-play-05.png' })
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l7r-play-06.png' })
  await dump('l7r-play-s03.json')
}
