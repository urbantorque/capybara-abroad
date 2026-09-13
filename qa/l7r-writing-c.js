async page => {
  const log = { walks: [], why: [] }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  log.started = await page.evaluate(() => window.__capy.state.started)
  const snap = () => page.evaluate(() => {
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 1 }
    const o = { toasts: [], bubbles: [], moment: null, place: null }
    for (const el of document.querySelectorAll('.capyui-toast')) if (vis(el)) o.toasts.push((el.innerText || '').replace(/\s+/g, ' ').trim())
    for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) o.bubbles.push((el.innerText || '').replace(/\s+/g, ' ').trim())
    const m = document.querySelector('.capyui-moment'); if (m && vis(m)) o.moment = (m.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const pl = document.querySelector('.capyui-place'); if (pl && vis(pl)) o.place = (pl.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    let leaf = 0, words = 0
    for (const el of document.querySelectorAll('[class*="capyui-"], .capynpc-bubble')) if (el.children.length === 0 && (el.innerText || '').trim() && vis(el) && el.closest('.capyui-jr, .capyui-pause, .capyui-led, .capyui-done, .capyui-title') === null) { leaf++; words += el.innerText.trim().split(/\s+/).length }
    o.leaf = leaf; o.words = words
    return o
  })
  const walk = async (biome, secs) => {
    const seen = new Set(); const lines = []; let maxWords = 0, maxLeaf = 0, sumWords = 0, nS = 0
    const t0 = Date.now()
    await page.keyboard.down('KeyW')
    for (let s = 0; s < secs; s += 2) {
      if (s % 10 === 0) { await page.keyboard.down('KeyA'); await page.waitForTimeout(600); await page.keyboard.up('KeyA') }
      if (s % 14 === 7) { await page.keyboard.press('Space') }
      await page.waitForTimeout(1400)
      const sn = await snap()
      const t = Math.round((Date.now() - t0) / 1000)
      for (const x of sn.toasts) if (!seen.has(x)) { seen.add(x); lines.push({ t, k: 'pill', x }) }
      for (const x of sn.bubbles) if (!seen.has('b' + x)) { seen.add('b' + x); lines.push({ t, k: 'bub', x }) }
      if (sn.moment && !seen.has('m' + sn.moment)) { seen.add('m' + sn.moment); lines.push({ t, k: 'moment', x: sn.moment }) }
      if (sn.place && !seen.has('p' + sn.place)) { seen.add('p' + sn.place); lines.push({ t, k: 'place', x: sn.place }) }
      maxWords = Math.max(maxWords, sn.words); maxLeaf = Math.max(maxLeaf, sn.leaf); sumWords += sn.words; nS++
    }
    await page.keyboard.up('KeyW')
    log.walks.push({ biome, secs, lines, maxWords, maxLeaf, meanWords: Math.round(sumWords / nS) })
  }
  await walk('sydney', 90)
  await page.screenshot({ path: 'qa/l7r-writing-walk-sydney.png' })
  for (const b of ['venice', 'sahara']) {
    await page.evaluate((bb) => window.__capy.hud.cross(bb), b)
    await page.waitForTimeout(9000)
    await walk(b, 90)
    await page.screenshot({ path: 'qa/l7r-writing-walk-' + b + '.png' })
  }
  // the journal: where the notebook sits, and the greyed rows' contrast
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  log.journalGeom = await page.evaluate(() => {
    const card = document.querySelector('.capyui-jr'); const nb = document.querySelector('.capyui-jrnb'); const rep = document.querySelector('.capyui-jrkeys')
    const sc = card; let scroller = card
    for (const el of [card, ...card.querySelectorAll('*')]) { const cs = getComputedStyle(el); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) { scroller = el; break } }
    const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]) }
    const cr = (el) => { const cs = getComputedStyle(el); let e = el, bg = null; while (e && e !== document.body) { const b = getComputedStyle(e).backgroundColor; const m = b.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.5)) { bg = b; break } e = e.parentElement } if (!bg) return null; let op = 1; e = el; while (e && e !== document.body) { op *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement } const l1 = lum(cs.color), l2 = lum(bg); const l1e = l1 * op + l2 * (1 - op); return { cr: Math.round(((Math.max(l1e, l2) + 0.05) / (Math.min(l1e, l2) + 0.05)) * 10) / 10, op: Math.round(op * 100) / 100, fs: parseFloat(cs.fontSize), color: cs.color } }
    const rows = [...document.querySelectorAll('.capyui-jrrow')]
    const r2 = rows[1], r2rec = r2 && r2.querySelector('.capyui-jrrec'), r2name = r2 && r2.querySelector('.capyui-jrname'), r2tally = r2 && r2.querySelector('.capyui-jrtally')
    return { scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, nbTop: nb ? nb.offsetTop : null, nbHidden: nb ? nb.hidden : null, rows: rows.length,
             shutRow: { cls: r2 && r2.className, rec: r2rec && cr(r2rec), name: r2name && cr(r2name), tally: r2tally && cr(r2tally) },
             openRow: { rec: cr(rows[0].querySelector('.capyui-jrrec')), name: cr(rows[0].querySelector('.capyui-jrname')) } }
  })
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  // a wheek at the marquee point in a chapter with no clock: is there a why?
  for (const [b, x, z] of [['kyoto', 4, 128], ['cali', 30, 40], ['manly', 0, -23.8]]) {
    await page.evaluate((bb) => window.__capy.hud.cross(bb), b)
    await page.waitForTimeout(9000)
    await page.evaluate(([xx, zz]) => { const g = window.__capy; const p = g.capy.body.position; p.x = xx + 3; p.z = zz + 3; p.y = Math.max(p.y, 2); g.capy.body.velocity.set(0, 0, 0) }, [x, z])
    await page.waitForTimeout(2500)
    const before = await snap()
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(900)
    await page.keyboard.press('KeyE'); await page.waitForTimeout(900)
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(1500)
    const after = await snap()
    const aud = await page.evaluate(() => { const g = window.__capy; const a = g.hud.toastAudit(); const p = g.capy.position; return { why: a.whyLast, live: a.live, pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], biome: g.biome.current, marq: document.querySelector('.capyui-marq') ? document.querySelector('.capyui-marq').innerText.replace(/\s+/g, ' ').slice(0, 200) : '' } })
    await page.screenshot({ path: 'qa/l7r-writing-why-' + b + '.png' })
    log.why.push({ biome: b, before: before.toasts, after: after.toasts, aud })
  }
  await page.evaluate((o) => fetch('/shot?name=l7r-writing-c.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
