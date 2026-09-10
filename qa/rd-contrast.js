async page => {
  // rd-contrast.js — measure WCAG contrast on the text the player actually
  // reads, in play, not on the title card.
  //
  // The existing qa/uicontrast.js measures the title card only, which is
  // exactly where the readable ink was already being used — so the check
  // passed for the whole time the in-play HUD was at 2.28:1.
  //
  // Computed from the RENDERED colour of each element against the rendered
  // colour of its nearest opaque ancestor, so a change to the paper or to the
  // alpha on the ink cannot make this quietly wrong.
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
  await shot('contrast-title')
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(3000)
  await page.evaluate((n) => { window.__capy.hud.cross(n) }, 'venice')
  await page.waitForTimeout(9000)
  await shot('contrast-hud')

  out.rows = await page.evaluate(() => {
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const parse = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s || '')
      if (!m) return null
      const p = m[1].split(',').map(x => parseFloat(x))
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
    }
    // walk up for something opaque to sit on
    const backOf = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor)
        if (c && c[3] > 0.85) return c
      }
      return [250, 246, 236, 1]
    }
    const over = (fg, bg) => {
      const a = fg[3]
      return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)]
    }
    const sel = ['.capyui-todo h2', '.capyui-aim', '.capyui-clue', '.capyui-count',
                 '.capyui-finds', '.capyui-task .capyui-txt', '.capyui-recnow',
                 '.capyui-label', '.capyui-momentkick', '.capyui-pickrec']
    const rows = []
    for (const s of sel) {
      const el = document.querySelector(s)
      if (!el) { rows.push({ sel: s, miss: true }); continue }
      const cs = getComputedStyle(el)
      const fg = parse(cs.color)
      if (!fg) { rows.push({ sel: s, miss: true }); continue }
      const bg = backOf(el)
      const c = over(fg, bg)
      const L1 = lum(c), L2 = lum(bg)
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      const px = parseFloat(cs.fontSize)
      const bold = parseInt(cs.fontWeight, 10) >= 700
      // WCAG large text is 18.66px bold or 24px; everything here is small
      const need = (px >= 24 || (bold && px >= 18.66)) ? 3.0 : 4.5
      const r = el.getBoundingClientRect()
      rows.push({ sel: s, ratio: +ratio.toFixed(2), px: +px.toFixed(1), bold: bold,
                  need: need, pass: ratio >= need,
                  shown: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' })
    }
    return rows
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-contrast.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
