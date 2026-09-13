async page => {
  const out = await page.evaluate(() => {
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
    const rows = []
    for (const el of document.querySelectorAll('[class*="capyui-"]')) {
      if (el.children.length) continue
      const t = (el.innerText || '').trim(); if (!t) continue
      if (!vis(el)) continue
      const cs = getComputedStyle(el)
      const bg = bgOf(el)
      let cr = null
      if (bg) { const l1 = lum(cs.color), l2 = lum(bg); if (l1 != null && l2 != null) cr = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10 }
      rows.push({ c: el.className, fs: parseFloat(cs.fontSize), color: cs.color, bg, cr, txt: t.slice(0, 50) })
    }
    return rows
  })
  const log = { hud: out }
  await page.evaluate(() => { window.__capy.hud.showDone(19, 'you are taking  ·  a plastic stool, slightly cracked', 'that will do here') })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l6r-writing-hanoi-done.png' })
  log.done = await page.evaluate(() => { const e = document.querySelector('.capyui-done'); return e ? e.innerText : '' })
  log.recap = await page.evaluate(() => [1, 10, 19].map(n => window.__capy.hud.chapRecap(n)))
  await page.waitForTimeout(6000)
  await page.evaluate((o) => fetch('/shot?name=l6r-writing-hud.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
