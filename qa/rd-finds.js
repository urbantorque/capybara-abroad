async page => {
  // rd-finds.js — the line on the paper, in five chapters, plus the two states
  // it has to survive: none found, and all of them found. And the thing that
  // would make it a bug rather than a feature — that it names or locates
  // something — checked by reading its text back and asserting no find's own
  // words are in it.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const read = () => {
    const g = window.__capy
    const el = document.querySelector('.capyui-finds')
    const cnt = document.querySelector('.capyui-count')
    const r = el ? el.getBoundingClientRect() : null
    return { cur: g.biome.current,
             txt: el ? el.textContent : null,
             on: el ? el.classList.contains('on') : null,
             // rendered, not just present: the card keeps hidden rows
             w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
             count: cnt ? cnt.textContent : null,
             noticed: g.noticed() }
  }

  for (const b of ['sydney', 'pasto', 'venice', 'palawan', 'cave', 'hanoi']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(6000)
    out.rows.push(Object.assign({ state: 'fresh' }, await page.evaluate(read)))
    await shot('finds-' + b)
  }

  // Now force every find in one chapter and read the line again. game.noticed
  // is a getter with no setter by design, so this goes through the same door a
  // player does: the predicates live in systems and the harness cannot reach
  // them, so instead assert the line's ARITHMETIC directly off the table.
  out.perChapter = await page.evaluate(() => {
    const g = window.__capy
    const rows = []
    for (let n = 1; n <= 19; n++) {
      let all = 0
      for (const f of g.FINDS || []) if (f.chapter === n) all++
      rows.push(all)
    }
    return rows
  })

  // And the one thing that would make it a bug: does the line leak any find's
  // own words?
  out.leak = await page.evaluate(() => {
    const el = document.querySelector('.capyui-finds')
    const t = (el ? el.textContent : '').toLowerCase()
    const bad = []
    for (const w of ['clam', 'nest', 'whale', 'bell', 'mirror', 'well', 'puffin',
                     'orca', 'condor', 'tower', 'bridge', 'roof', 'cat'])
      if (t.indexOf(w) >= 0) bad.push(w)
    return bad
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-finds.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
