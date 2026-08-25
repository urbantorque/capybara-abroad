async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const SPOTS = [
    // name, biome, capy x/y/z — chosen to LOOK AT what job 2 reallocated
    ['q-apron',   'quay',     0,   0,   26],
    ['q-fairway', 'quay',    70,   0, -300],
    ['d-shelf',   'drift',    0,  31,   30],
    ['d-crown',   'drift',   36, 109, -184],
    ['p-road',    'pantanal', 0,   0,    0],
    ['p-campo',   'pantanal', -60, 0,  -40],
  ]
  for (const s of SPOTS) {
    await page.evaluate((S) => {
      const g = window.__capy
      if (g.biome.current !== S[1]) g.biome.switchTo(S[1])
      const b = g.capy.body
      b.position.set(S[2], S[3] + 1.2, S[4]); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false)
    }, s)
    await page.evaluate(() => new Promise(r => setTimeout(r, 1400)))
    await page.screenshot({ path: 'qa/J2-' + s[0] + '.png' })
  }
}
