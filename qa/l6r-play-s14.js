async page => {
  const dump = async (name) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-40), err: g.state.lastError }
    })
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyA')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/l6r-play-32.png' })
  await dump('l6r-play-s14a.json')
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyA')
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l6r-play-33.png' })
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l6r-play-34.png' })
  await dump('l6r-play-s14.json')
}
