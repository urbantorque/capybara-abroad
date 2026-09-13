async page => {
  const log = { depart: [], arrive: [], pills: [] }
  await page.setViewportSize({ width: 1280, height: 720 })
  const grab = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { txt: (e.innerText || '').replace(/\n+/g, ' / ').slice(0, 600), op: cs.opacity, w: Math.round(r.width), h: Math.round(r.height) } }, sel)
  const fonts = (sel) => page.evaluate((s) => {
    const out = []
    for (const el of document.querySelectorAll(s + ' *')) {
      if (el.children.length) continue
      const t = (el.innerText || '').trim(); if (!t) continue
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (r.width < 1) continue
      out.push({ c: el.className, fs: parseFloat(cs.fontSize), color: cs.color, w: Math.round(r.width), txt: t.slice(0, 140) })
    }
    return out
  }, sel)
  // 1. Sydney: ten rows, then travel to Pasto — the ENOUGH departure card
  await page.evaluate(() => { const g = window.__capy; for (const id of g.hud.taskIds(1).slice(0, 10)) { try { g.hud.completeTask(id) } catch (e) {} } })
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__capy.hud.travel(2))
  await page.waitForTimeout(1300)
  await page.screenshot({ path: 'qa/l7r-writing-depart-sydney.png' })
  log.depart.push({ from: 'sydney', card: await grab('.capyui-done'), fonts: await fonts('.capyui-done') })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/l7r-writing-white-pasto.png' })
  log.arrive.push({ to: 'pasto', place: await grab('.capyui-place'), fade: await grab('.capyui-fade') })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l7r-writing-arrive-pasto.png' })
  log.pastoBiome = await page.evaluate(() => window.__capy.biome.current)
  // the journal with the notebook fold, after one departure
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  await page.evaluate(() => { const d = document.querySelector('.capyui-jrnb'); if (d) { d.open = true; d.scrollIntoView() } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/l7r-writing-journal-notebook-1.png' })
  log.nb1 = await grab('.capyui-nb')
  log.nbFonts = await fonts('.capyui-nb')
  log.nbPos = await page.evaluate(() => { const d = document.querySelector('.capyui-jrnb'); const c = document.querySelector('.capyui-jr'); if (!d || !c) return null; return { hidden: d.hidden, open: d.open, top: Math.round(d.getBoundingClientRect().top), cardScroll: c.scrollHeight, cardH: c.clientHeight, sumTxt: d.querySelector('summary') && d.querySelector('summary').innerText } })
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  // 2. Three more chapters at one row each: the NOT-ENOUGH departure card
  for (const [b, n, next] of [['venice', 10, 11], ['hanoi', 19, 1], ['kyoto', 4, 5]]) {
    await page.evaluate((bb) => window.__capy.hud.cross(bb), b)
    await page.waitForTimeout(2600)
    log.arrive.push({ to: b, place: await grab('.capyui-place') })
    await page.waitForTimeout(7000)
    await page.screenshot({ path: 'qa/l7r-writing-arrive-' + b + '.png' })
    // naive walk 60 s: W held, a turn every 8 s; count pills
    const seen = new Set(); const lines = []
    await page.keyboard.down('KeyW')
    const t0 = Date.now()
    for (let s = 0; s < 60; s += 2) {
      if (s % 8 === 0) { await page.keyboard.down('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyA') }
      await page.waitForTimeout(1500)
      const sn = await page.evaluate(() => {
        const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 1 }
        const o = { toasts: [], bubbles: [], why: null }
        for (const el of document.querySelectorAll('.capyui-toast')) if (vis(el)) o.toasts.push((el.innerText || '').replace(/\s+/g, ' ').trim())
        for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) o.bubbles.push((el.innerText || '').replace(/\s+/g, ' ').trim())
        const w = document.querySelector('.capyui-why'); if (w && vis(w)) o.why = w.innerText
        const pl = document.querySelector('.capyui-place'); if (pl && vis(pl)) o.place = (pl.innerText || '').replace(/\s+/g, ' ').trim()
        return o
      })
      const t = Math.round((Date.now() - t0) / 1000)
      for (const x of sn.toasts) if (!seen.has(x)) { seen.add(x); lines.push({ t, k: 'pill', x }) }
      for (const x of sn.bubbles) if (!seen.has('b' + x)) { seen.add('b' + x); lines.push({ t, k: 'bub', x }) }
      if (sn.place && !seen.has('p' + sn.place)) { seen.add('p' + sn.place); lines.push({ t, k: 'place', x: sn.place }) }
    }
    await page.keyboard.up('KeyW')
    log.pills.push({ biome: b, lines })
    await page.screenshot({ path: 'qa/l7r-writing-walk60-' + b + '.png' })
    // one real row, then travel: the not-enough card
    await page.evaluate((nn) => { const g = window.__capy; const ids = g.hud.taskIds(nn).filter(i => i.indexOf('to-') !== 0); try { g.hud.completeTask(ids[0]) } catch (e) {} }, n)
    await page.waitForTimeout(2500)
    await page.evaluate((nx) => window.__capy.hud.travel(nx), next)
    await page.waitForTimeout(1300)
    await page.screenshot({ path: 'qa/l7r-writing-depart-' + b + '.png' })
    log.depart.push({ from: b, card: await grab('.capyui-done'), fonts: await fonts('.capyui-done') })
    await page.waitForTimeout(9000)
  }
  // 3. the notebook with four pages
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  await page.evaluate(() => { const d = document.querySelector('.capyui-jrnb'); if (d) { d.open = true; d.scrollIntoView() } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/l7r-writing-journal-notebook-4.png' })
  log.nb4 = await grab('.capyui-nb')
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  // 4. the coda and the ledger, forced (no finale staged: the captions and the receipt)
  await page.evaluate(() => window.__capy.hud.cross('sydney'))
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.hud.finaleClose())
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l7r-writing-coda-1.png' })
  log.coda1 = await grab('.capyui-coda')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-writing-coda-2.png' })
  log.coda2 = await grab('.capyui-coda')
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'qa/l7r-writing-ledger.png' })
  log.ledger = await grab('.capyui-led')
  log.ledFonts = await fonts('.capyui-led')
  log.body = await page.evaluate(() => document.body.innerText.slice(0, 3000))
  await page.evaluate((o) => fetch('/shot?name=l7r-writing-b.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
