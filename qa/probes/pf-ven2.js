async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const V = g.venice
    // ---- named probe points ------------------------------------------------
    const brd = V.boardKnots()
    const ri = V.rialto()
    const PTS = [
      ['piazza-mid', V.piazza.x, V.piazza.z],
      ['piazzetta', -4, -20],
      ['molo', V.molo.x, V.molo.z],
      ['calli', V.calli.x, V.calli.z],
      ['campo', V.campo.x, V.campo.z],
      ['cafe', V.cafe.x, V.cafe.z],
      ['rialto-deck', ri.x, ri.z],
      ['board0', brd[0], brd[1]],
      ['board-mid', brd[brd.length >> 1 | 0], brd[(brd.length >> 1 | 0) + 1]],
      ['spawn', sp.x, sp.z],
      ['arcade-N', V.piazza.x, V.piazza.z - 12],
      ['fondamenta', -40, -30],
      ['lagoon', -4, 40],
    ]
    const zones = ['piazza', 'piazzetta', 'square', 'molo', 'lagoon', 'calli', 'canal', 'rialto', 'campo', 'cafe']
    function sample(tag) {
      const o = []
      for (const [n, x, z] of PTS) {
        const ty = V.terrainHeight(x, z)
        o.push({ n, x, z, ty: +ty.toFixed(2),
          sp: +V.surfacePitch(x, z, ty).toFixed(3),
          ow: V.isOverWater(x, z) ? 1 : 0,
          wy: +V.waterHeightAt(x, z).toFixed(2),
          zn: zones.filter(q => V.inZone(q, x, z)).join('|') })
      }
      r[tag] = { tide: +V.tide().toFixed(3), tideY: +V.tideY().toFixed(2), boards: +V.boardsOut().toFixed(2), pts: o }
    }
    sample('low')
    // run to the top of the tide
    for (let i = 0; i < 120 * 60 && V.tide() < 0.99; i++) g.tick(1 / 60, false)
    sample('high')
    return r
  })

  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venB.json', { method: 'POST', body: bb })
  }, { out, errs })
}
