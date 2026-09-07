async page => {
  // ---------------------------------------------------------------------------
  // qa/first-rows.js — HOW FAR IS THE FIRST THING TO DO? (ROADMAP-FUN, item 2)
  //
  // The B1 baseline found six chapters in which ninety seconds of wandering
  // ticks NOTHING — the Quay, Kyoto, Iceland, Marrakech, Hong Kong and Palawan.
  // Item 2 blames placement: "guarantee that the first two rows of act one have
  // their subject inside 12 m of spawn". This measures it, per chapter, on the
  // arrival frame, before anything is authored:
  //
  //   d1, d2   metres from the spawn to the first two open rows' hint targets
  //   ring     how many live props are within 14 m of the spawn
  //   people   how many people are within 14 m
  //
  // The rows are read off the PAPER — `todoTopId` and the window — rather than
  // off TASKS, because the window is act-aware and a chapter's first two open
  // rows are not simply its first two rows.
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  // id -> text, so a row on the paper can be turned back into a task id.
  const src = await page.evaluate(() => fetch('/src/shared.js').then(r => r.text()))
  const BYTEXT = {}
  {
    const ti = src.indexOf('export const TASKS')
    const ci = src.indexOf('export const CHAPTERS')
    const recs = src.slice(ti, ci).split(/\n  \{ id: /).slice(1)
    for (const r of recs) {
      const cut = r.indexOf('\n  { id: ')
      const body = r.slice(0, cut >= 0 ? cut : r.length)
      const id = (body.match(/^'([a-z0-9-]+)'/) || [])[1]
      const tx = (body.match(/text: '([^']*)'/) || [])[1]
      if (id && tx) BYTEXT[tx.replace(/\\'/g, "'")] = id
    }
  }

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(6500)
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const p = g.capy.position
      // Rendered rows only. `.capyui-todo .capyui-txt` returns chapter one's
      // rows in every chapter — the paper keeps its hidden ones — so measure
      // rects, which is the same trap the D6 probe was caught by.
      const open = []
      for (const li of document.querySelectorAll('.capyui-task')) {
        if (li.getBoundingClientRect().height <= 0) continue
        if (li.classList.contains('done')) continue
        const t = li.querySelector('.capyui-txt')
        if (t && t.textContent) open.push(t.textContent)
      }
      const out = { biome: g.biome.current, want: arg.b, rows: open.slice(0, 3), d: [] }
      for (const tx of open.slice(0, 3)) {
        const id = arg.byText[tx] || ''
        const h = id ? g.hintTarget(id) : null
        out.d.push({ id: id || ('?' + tx), d: h ? +Math.hypot(h.x - p.x, h.z - p.z).toFixed(1) : null })
      }
      // What is actually standing in the spawn ring.
      const R = 14
      let props = 0
      for (const q of (g.props || [])) {
        const bp = q && q.body && q.body.position
        if (!bp) continue
        if (Math.hypot(bp.x - p.x, bp.z - p.z) < R) props++
      }
      // Both collections, because they are two different shapes and a count of
      // one of them reads as zero in the chapters that use the other. See
      // saySomebodyNear in npc.js.
      let people = 0
      for (const q of (g.npcs || [])) {
        const gp = q && q.group && q.group.position
        if (gp && Math.hypot(gp.x - p.x, gp.z - p.z) < R) people++
      }
      const live = g.biome.current
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== live) continue
        if (Math.hypot(L.x - p.x, L.z - p.z) < R) people++
      }
      out.props = props
      out.people = people
      return out
    }, { b: b, byText: BYTEXT })
    rows.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=first-rows.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
