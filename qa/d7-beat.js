async page => {
  // WHO HAS A JOB, AND ARE THEY DOING IT — the nineteen chapters.
  //
  // A `beat:` written into a chapter's local table is only carried through if
  // that chapter hands the whole option object to addLocal. Several build the
  // call field by field (`{ biome, x, y, z, near, face, figure, lines, wheek }`)
  // and a new property added to the table is silently dropped — which reads
  // exactly like a feature that does not work. `withJob` per chapter is the
  // only way to see it; `swings` over a 45 s park is the only way to see the
  // beat actually running, because the action is under a second long on a
  // five-second clock and almost nobody is mid-swing in any given frame.
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(8000)
    await page.evaluate(() => { window.__capy.beatAudit(true) })
    await page.waitForTimeout(45000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const b = g.beatAudit()
      return { biome: g.biome.current, locals: g.reactAudit().locals,
               withJob: b.withJob, running: b.running,
               swings: b.rows.reduce((a, x) => a + x.swings, 0),
               kinds: b.rows.map(x => x.kind + '/' + (x.sfx || '-') + ':' + x.swings).join(' '),
               err: g.state.lastError || '' }
    })
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-beat.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
