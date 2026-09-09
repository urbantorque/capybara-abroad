async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)

  const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [900, 620], [390, 844]]
  const out = { tiny: [], overflow: [], focus: null, escape: null, pageErrors: errs }

  const scanText = () => page.evaluate(() => {
    const bad = [], seen = new Set()
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return
      // a closed <details> still returns rects for its children in Chromium
      for (let p = el; p; p = p.parentElement) {
        if (p.tagName === 'DETAILS' && !p.open && p.firstElementChild !== el) return
      }
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.height < 2) return
      if (el.children.length) return
      const t = (el.textContent || '').trim()
      if (t.length < 3) return
      const fs = parseFloat(cs.fontSize)
      if (fs && fs < 11) {
        const k = (typeof el.className === 'string' ? el.className : el.tagName) + '|' + fs
        if (!seen.has(k)) { seen.add(k); bad.push([k, +fs.toFixed(1)]) }
      }
    })
    return { tiny: bad,
             overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
  })

  // ---- the title card, then the game, at every size ----------------------
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(600)
    const r = await scanText()
    if (r.tiny.length) out.tiny.push({ size: w + 'x' + h, where: 'title', rows: r.tiny })
    if (r.overflowX) out.overflow.push(w + 'x' + h + ' title')
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(400)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // put a picture in the album so its button and its captions exist
  await page.keyboard.press('k'); await page.waitForTimeout(900)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
  await page.keyboard.press('k'); await page.waitForTimeout(600)

  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(500)
    await page.keyboard.press('j'); await page.waitForTimeout(700)
    let r = await scanText()
    if (r.tiny.length) out.tiny.push({ size: w + 'x' + h, where: 'journal', rows: r.tiny })
    if (r.overflowX) out.overflow.push(w + 'x' + h + ' journal')
    // the ledger
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button.capyui-jrled'))
        .find(x => /laid out/.test(x.textContent))
      if (b) { b.focus(); b.click() }
    })
    await page.waitForTimeout(800)
    r = await scanText()
    if (r.tiny.length) out.tiny.push({ size: w + 'x' + h, where: 'ledger', rows: r.tiny })
    if (r.overflowX) out.overflow.push(w + 'x' + h + ' ledger')
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)
    await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  }

  // ---- 1. focus returns to the button that opened the ledger -------------
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(400)
  await page.keyboard.press('j'); await page.waitForTimeout(700)
  out.focus = await page.evaluate(async () => {
    const b = Array.from(document.querySelectorAll('button.capyui-jrled'))
      .find(x => /laid out/.test(x.textContent))
    if (!b) return { issue: 'no ledger button' }
    b.focus()
    const before = document.activeElement === b
    b.click()
    await new Promise(r => setTimeout(r, 600))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
    await new Promise(r => setTimeout(r, 600))
    const a = document.activeElement
    return { focusedButtonFirst: before,
             backOnButton: a === b,
             landedOn: a ? ((typeof a.className === 'string' && a.className) || a.tagName) : 'null' }
  })
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)

  // ---- 2. Escape puts the camera away before it opens the journal --------
  out.escape = await page.evaluate(async () => {
    const g = window.__capy
    const shown = () => ({
      photo: !!document.querySelector('.capyui-phud.show, .capyui-photo.show') ||
             document.body.classList.contains('capyphoto'),
      jr: !!document.querySelector('.capyui-jrcard.show')
    })
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true }))
    await new Promise(r => setTimeout(r, 700))
    const withCam = shown()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
    await new Promise(r => setTimeout(r, 700))
    const after = shown()
    return { withCam, after, err: g.state.lastError || null }
  })

  await page.evaluate(async (o) => { await fetch('/shot?name=b4-uifix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
