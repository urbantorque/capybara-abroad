async page => {
  const log = {}
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l7r-writing-title-1280.png' })
  log.title1280 = await page.evaluate(() => {
    const t = document.querySelector('.capyui-title')
    const rows = []
    for (const el of document.querySelectorAll('.capyui-title *')) {
      if (el.children.length) continue
      const s = (el.innerText || '').trim(); if (!s) continue
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      rows.push({ c: el.className, fs: parseFloat(cs.fontSize), w: Math.round(r.width), txt: s.slice(0, 120) })
    }
    return { text: t ? t.innerText : '', rows }
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-writing-title-1920.png' })
  log.title1920 = await page.evaluate(() => {
    const rows = []
    for (const el of document.querySelectorAll('.capyui-title *')) {
      if (el.children.length) continue
      const s = (el.innerText || '').trim(); if (!s) continue
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      rows.push({ c: el.className, fs: parseFloat(cs.fontSize), w: Math.round(r.width), txt: s.slice(0, 80) })
    }
    return rows
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  log.started = await page.evaluate(() => window.__capy.state.started)
  await page.screenshot({ path: 'qa/l7r-writing-syd-arrive-1280.png' })
  const census = () => page.evaluate(() => {
    const vis = (el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
    }
    const lum = (c) => {
      const m = c.match(/[\d.]+/g); if (!m) return null
      const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2])
    }
    const bgOf = (el) => { let e = el; while (e && e !== document.body) { const b = getComputedStyle(e).backgroundColor; const m = b.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.5)) return b; e = e.parentElement } return null }
    const rows = []; let words = 0
    for (const el of document.querySelectorAll('[class*="capyui-"], .capynpc-bubble')) {
      if (el.children.length) continue
      const t = (el.innerText || '').trim(); if (!t) continue
      if (!vis(el)) continue
      const cs = getComputedStyle(el); const bg = bgOf(el)
      let cr = null
      if (bg) { const l1 = lum(cs.color), l2 = lum(bg); if (l1 != null && l2 != null) cr = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10 }
      words += t.split(/\s+/).length
      rows.push({ c: el.className, fs: parseFloat(cs.fontSize), cr, txt: t.slice(0, 60) })
    }
    const todo = document.querySelector('.capyui-todo'); const r = todo ? todo.getBoundingClientRect() : null
    return { rows, words, todo: r ? { w: Math.round(r.width), h: Math.round(r.height), pct: Math.round(r.height / innerHeight * 100) } : null, vw: innerWidth, vh: innerHeight }
  })
  log.sydArrive1280 = await census()
  // the paper at 1920
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-writing-syd-arrive-1920.png' })
  log.sydArrive1920 = await census()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(800)
  // the journal, fresh file
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l7r-writing-syd-journal-fresh.png' })
  log.journalFresh = await page.evaluate(() => { const e = document.querySelector('.capyui-jr'); return e ? e.innerText : '' })
  log.journalFreshCensus = await census()
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  // tick five Sydney rows, then open the journal again and the notebook fold
  log.ticked = await page.evaluate(() => {
    const g = window.__capy; const ids = g.hud.taskIds(1); const out = []
    for (const id of ids.slice(0, 6)) { try { g.hud.completeTask(id); out.push(id) } catch (e) { out.push('ERR ' + id + ' ' + e.message) } }
    return out
  })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l7r-writing-syd-after-ticks.png' })
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l7r-writing-syd-journal-6.png' })
  log.journal6 = await page.evaluate(() => { const e = document.querySelector('.capyui-jr'); return e ? e.innerText : '' })
  log.journal6Census = await census()
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  await page.evaluate((o) => fetch('/shot?name=l7r-writing-a.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
