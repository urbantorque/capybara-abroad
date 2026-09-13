async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g && g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-30), err: g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  // turn back toward the lawn: S for a moment, then hop
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  await page.waitForTimeout(350)
  await page.screenshot({ path: 'qa/l7r-play-12.png' })
  await page.waitForTimeout(900)
  await dump('l7r-play-s06a.json')
  // run with shift for 2.5s
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyS')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/l7r-play-13.png' })
  await dump('l7r-play-s06.json')
}
