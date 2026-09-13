async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5000)
  // page two of the title card: the picker
  await page.evaluate(() => { const b = document.querySelector('.capyui-go.alt'); if (b) b.click() })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) } }
    const picks = document.querySelector('.capyui-picks')
    const tiles = [...document.querySelectorAll('.capyui-pick:not(.hero)')]
    const rows = {}
    for (const t of tiles) { const y = Math.round(t.getBoundingClientRect().top); rows[y] = (rows[y] || 0) + 1 }
    return {
      inner: innerHeight, card: r(document.querySelector('.capyui-card')), hero: r(document.querySelector('.capyui-pick.hero')),
      route: r(document.querySelector('.capyui-routewrap')), picks: r(picks),
      picksScroll: picks ? { sh: picks.scrollHeight, ch: picks.clientHeight, st: picks.scrollTop } : null,
      rows, last: r(tiles[tiles.length - 1]), foot: r(document.querySelector('.capyui-p2foot')),
    }
  })
  await page.screenshot({ path: 'qa/l6-paper-picker.png' })
  await page.evaluate((o) => fetch('/shot?name=l6-paper-picker.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
