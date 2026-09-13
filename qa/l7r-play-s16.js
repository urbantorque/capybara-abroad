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
  // drag to look around 180 degrees
  await page.mouse.move(640, 400)
  await page.mouse.down()
  await page.mouse.move(1200, 400, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'qa/l7r-play-27.png' })
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-play-28.png' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-play-29.png' })
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'qa/l7r-play-30.png' })
  await dump('l7r-play-s16.json')
}
