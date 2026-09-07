async page => {
  // ---------------------------------------------------------------------------
  // qa/b14-shots.js — B14 JUDGED BY EYE
  //
  // Four surfaces, and the phone is not optional on two of them: the
  // departures card's subtitle now carries FIVE chips on one uppercase line
  // with .3em of letter-spacing, and the arrival card grew a fourth element
  // under a heading that is already clamp(…,tHu) tall.
  // ---------------------------------------------------------------------------
  const shot = async (name, w, h) => {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(1400)
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  // ---- 1. the arrival card, at the top of the table -----------------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(70, 20, 12) })
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(3100)
  await shot('b14-arrive.png', 1280, 800)
  await page.waitForTimeout(600)
  await page.evaluate(() => { window.__capy.hud.cross('kowloon') })
  await page.waitForTimeout(3100)
  await shot('b14-arrive-phone.png', 390, 780)
  await page.waitForTimeout(9000)

  // ---- 2 + 3. the two cards ----------------------------------------------
  const open = async () => await page.evaluate(async () => {
    const byText = t => [].find.call(document.querySelectorAll('button'),
                                     b => (b.textContent || '').trim() === t)
    const press = el => { if (!el) return false
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      el.click(); return true }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    await new Promise(r => setTimeout(r, 700))
    const ok = press(byText('the journey so far'))
    // ...AND SCROLLED BACK TO ITS OWN TOP. The card keeps its scroll position
    // between openings and the subtitle — which is the whole subject of this
    // shot — was off the top of the frame in the first pass.
    await new Promise(r => setTimeout(r, 500))
    const c = document.querySelector('.capyui-jrcard')
    if (c) c.scrollTop = 0
    const w = document.querySelector('.capyui-jr')
    if (w) w.scrollTop = 0
    return ok
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(800)
  await open()
  await page.waitForTimeout(1100)
  await shot('b14-board.png', 1280, 800)
  await page.evaluate(async () => {
    const byText = t => [].find.call(document.querySelectorAll('button'),
                                     b => (b.textContent || '').trim() === t)
    const el = byText('the journey, laid out')
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    el.click()
  })
  await page.waitForTimeout(1400)
  await shot('b14-ledger.png', 1280, 800)
  await shot('b14-ledger-phone.png', 390, 780)
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
  })
  await page.waitForTimeout(700)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
  })
  await page.waitForTimeout(700)

  // ---- 4. the phone's departures card, which is the crowded one -----------
  await page.setViewportSize({ width: 390, height: 780 })
  await page.waitForTimeout(1000)
  await open()
  await page.waitForTimeout(1200)
  await shot('b14-board-phone.png', 390, 780)
  await page.setViewportSize({ width: 1280, height: 800 })
}
