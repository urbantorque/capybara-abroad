async page => {
  // DOES EVERY ROW OF sysAMB_AT RESOLVE TO A POINT?
  //
  // The table is nineteen chapters of api keys read out of nineteen chapter
  // files, and a wrong key is SILENT by design: sysAmbAnchor returns false and
  // the voice goes back on the ring, which is exactly what it did before, so a
  // typo ships as "that feature did nothing". `game.ambAnchors()` resolves
  // every row in the live chapter; this walks the nineteen and prints them.
  //
  // It also reports the DISTANCE from the spawn, because an anchor that
  // resolves is not yet an anchor that is any good: a landmark 900 m away is
  // past sysAMB_ANCH_FAR and will never be heard, and one 3 m away is the ring
  // with extra steps.
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(9000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const a = g.ambAnchors()
      return { biome: a.biome, rows: a.rows, err: g.state.lastError || '' }
    })
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-anchor.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
