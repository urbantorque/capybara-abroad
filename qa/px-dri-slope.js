// IS THE DRIFT'S slopeAt STUB HONEST?
//
// drift.js:602 is `function driSlope() { return 0; }` against sixteen other
// publishers that difference their terrain. qa/px-hooks.js measured the stub
// disagreeing with a central difference of driTerrain by 0.72 on average, and
// X8 recorded that as a defect without fixing it.
//
// But driTerrain returns an ISLAND'S DECK HEIGHT - one constant per island, and
// driCLOUD_Y over the void. That is a piecewise-constant function, so a central
// difference of it is 0 everywhere except at an island edge, where it is a step
// and the difference is meaningless: the quotient there is not a gradient, it is
// the cliff height divided by the sample spacing, and it grows without bound as
// the spacing shrinks.
//
// So split the grid. INTERIOR = both probe samples land on the same island.
// EDGE = they do not. If the interior gradient is 0 and the 0.72 lives entirely
// on the edges, the stub is exactly right and it is px-hooks that is wrong.
async page => {
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.keyboard.press('Digit9')
  await page.waitForTimeout(7000)

  out.biome = await page.evaluate(() => window.__capy.biome.current)
  Object.assign(out, await page.evaluate(() => {
    const a = window.__capy.drift
    const H = (x, z) => a.terrainHeight(x, z)
    const S = (x, z) => a.slopeAt(x, z)
    const E = 0.5
    // the cloud datum is what terrainHeight returns over the void
    let cloud = H(9999, 9999)
    const interior = [], edge = []
    let sMax = 0
    for (let x = -140; x <= 140; x += 4) {
      for (let z = -160; z <= 40; z += 4) {
        const h = H(x, z)
        if (h === cloud) continue          // the void is not ground
        const hx0 = H(x - E, z), hx1 = H(x + E, z)
        const hz0 = H(x, z - E), hz1 = H(x, z + E)
        const same = hx0 === h && hx1 === h && hz0 === h && hz1 === h
        const gx = (hx1 - hx0) / (2 * E), gz = (hz1 - hz0) / (2 * E)
        const grad = Math.hypot(gx, gz)
        const s = S(x, z)
        if (s > sMax) sMax = s
        ;(same ? interior : edge).push(grad)
      }
    }
    const mean = v => v.length ? v.reduce((p, c) => p + c, 0) / v.length : null
    const max = v => v.length ? v.reduce((p, c) => Math.max(p, c), 0) : null
    // how many distinct deck heights are there? a flat-deck chapter has few.
    const decks = {}
    for (let x = -140; x <= 140; x += 4) for (let z = -160; z <= 40; z += 4) {
      const h = H(x, z); if (h === cloud) continue
      decks[h.toFixed(3)] = (decks[h.toFixed(3)] || 0) + 1
    }
    return {
      cloudY: cloud,
      slopeAtAlwaysZero: sMax === 0,
      slopeAtMax: sMax,
      nInterior: interior.length, nEdge: edge.length,
      interiorMeanGrad: mean(interior), interiorMaxGrad: max(interior),
      edgeMeanGrad: mean(edge), edgeMaxGrad: max(edge),
      allMeanGrad: mean(interior.concat(edge)),
      distinctDeckHeights: Object.keys(decks).length,
      deckHistogram: Object.keys(decks).sort((p, q) => decks[q] - decks[p]).slice(0, 8)
        .map(k => [k, decks[k]])
    }
  }))
  // and the same central difference at a finer spacing: a real gradient is
  // stable under refinement, a step is not
  out.refine = await page.evaluate(() => {
    const a = window.__capy.drift
    const H = (x, z) => a.terrainHeight(x, z)
    const cloud = H(9999, 9999)
    const at = {}
    for (const E of [1.0, 0.5, 0.25, 0.125]) {
      let sum = 0, n = 0
      for (let x = -140; x <= 140; x += 4) for (let z = -160; z <= 40; z += 4) {
        const h = H(x, z); if (h === cloud) continue
        const gx = (H(x + E, z) - H(x - E, z)) / (2 * E)
        const gz = (H(x, z + E) - H(x, z - E)) / (2 * E)
        sum += Math.hypot(gx, gz); n++
      }
      at[E] = n ? +(sum / n).toFixed(3) : null
    }
    return at
  })
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=px-dri-slope.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
