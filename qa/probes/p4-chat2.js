async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = []
  const jobs = [['kyoto',5],['cali',5],['rio',4],['kyoto',9]]
  for (const j of jobs) {
    await page.evaluate((b) => { const g = window.__capy; g.biome.switchTo(b) }, j[0])
    await page.waitForTimeout(1200)
    const info = await page.evaluate((a) => {
      const g = window.__capy
      const L = g.locals.filter(l => l.biome === a.b)[a.i]
      const api = g[a.b]
      return { at: [L.x, L.y, L.z].map(v => +v.toFixed(1)), near: L.near, cool: L.cool,
               terr: +api.terrainHeight(L.x, L.z).toFixed(2),
               overWater: api.isOverWater ? api.isOverWater(L.x, L.z) : null,
               nLines: L.lines ? L.lines.length : 0 }
    }, { b: j[0], i: j[1] })
    // pin the animal beside them for 2 s
    for (let k = 0; k < 8; k++) {
      await page.evaluate((a) => {
        const g = window.__capy
        const L = g.locals.filter(l => l.biome === a.b)[a.i]
        const bd = g.capy.body
        bd.position.set(L.x + 1.8, L.y + 0.8, L.z + 1.8); bd.velocity.set(0,0,0)
        bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
      }, { b: j[0], i: j[1] })
      await page.waitForTimeout(280)
    }
    info.said = await page.evaluate(() => {
      const bubs = [...document.querySelectorAll('#hud div')].filter(d => d.style.borderRadius === '13px' && d.style.display === 'block')
      return bubs.map(b => b.textContent).join(' | ')
    })
    info.key = j[0] + '#' + j[1]
    out.push(info)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4chat2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
