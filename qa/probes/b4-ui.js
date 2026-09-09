async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [900, 620], [390, 844]]
  const out = { title: [], panels: [], roles: null, notes: [] }

  const scan = () => page.evaluate(() => {
    const res = { overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                  clipped: [], tiny: [], smallHit: [], open: [] }
    const seen = new Set()
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.height < 2) return
      const cls = (typeof el.className === 'string' && el.className) || el.id || el.tagName
      // OFF-SCREEN: any part of a visible box outside the viewport
      if (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1) {
        const k = 'c' + cls
        if (!seen.has(k) && res.clipped.length < 14) {
          seen.add(k)
          res.clipped.push([cls, Math.round(b.left), Math.round(b.top),
                            Math.round(b.right), Math.round(b.bottom), innerWidth, innerHeight])
        }
      }
      const fs = parseFloat(cs.fontSize)
      if (fs && fs < 11 && el.children.length === 0 && el.textContent.trim().length > 2) {
        const k = 't' + cls
        if (!seen.has(k) && res.tiny.length < 10) { seen.add(k); res.tiny.push([cls, +fs.toFixed(1)]) }
      }
      const role = el.getAttribute && el.getAttribute('role')
      if ((role === 'button' || el.tagName === 'BUTTON') && (b.width < 24 || b.height < 24)) {
        const k = 'h' + cls
        if (!seen.has(k) && res.smallHit.length < 10) {
          seen.add(k); res.smallHit.push([cls, Math.round(b.width), Math.round(b.height)])
        }
      }
    })
    document.querySelectorAll('[role="dialog"]').forEach(d => {
      const cs = getComputedStyle(d)
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05)
        res.open.push((typeof d.className === 'string' && d.className) || d.id)
    })
    return res
  })

  // ---- 1. the title card at every size, before the game is started -------
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(800)
    const r = await scan()
    r.size = w + 'x' + h
    out.title.push(r)
  }

  // ---- 2. start, then every panel at every size --------------------------
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2600)

  // put something in the album and the ledger so their cards are not empty
  await page.evaluate(() => {
    const g = window.__capy
    try { g.photo && g.photo(true) } catch (e) {}
  })
  await page.waitForTimeout(400)

  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(600)

    // journal (J)
    await page.keyboard.press('j'); await page.waitForTimeout(700)
    let r = await scan(); r.size = w + 'x' + h; r.panel = 'journal'; out.panels.push(r)

    // ledger — the journal's own button
    const led = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button.capyui-jrled'))
        .find(x => /laid out/.test(x.textContent))
      if (!b) return null
      b.click(); return true
    })
    await page.waitForTimeout(800)
    r = await scan(); r.size = w + 'x' + h; r.panel = 'ledger'; r.reached = !!led; out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)

    // board (Tab)
    await page.keyboard.press('Tab'); await page.waitForTimeout(700)
    r = await scan(); r.size = w + 'x' + h; r.panel = 'board'; out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)

    // photo mode / album
    await page.keyboard.press('k'); await page.waitForTimeout(600)
    r = await scan(); r.size = w + 'x' + h; r.panel = 'photo'; out.panels.push(r)
    await page.keyboard.press('k'); await page.waitForTimeout(400)
  }

  // ---- 3. role traps -----------------------------------------------------
  out.roles = await page.evaluate(() => {
    const bad = []
    const cls = el => (typeof el.className === 'string' && el.className) || el.id || el.tagName
    document.querySelectorAll('[role]').forEach(el => {
      const r = el.getAttribute('role'), t = el.tagName
      if (r === 'listitem' && t === 'BUTTON') bad.push(['listitem-on-button', cls(el)])
      if (r === 'button' && !el.getAttribute('aria-label') && !el.textContent.trim())
        bad.push(['nameless-button-role', cls(el)])
      if (r === 'dialog' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
        bad.push(['nameless-dialog', cls(el)])
    })
    document.querySelectorAll('button').forEach(el => {
      if (!el.getAttribute('aria-label') && !el.textContent.trim()) bad.push(['nameless-button', cls(el)])
    })
    return bad
  })
  out.err = await page.evaluate(() => (window.__capy && window.__capy.state.lastError) || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-ui.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
