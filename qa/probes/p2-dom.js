async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)

  const out = {}
  out.board = await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-40, g.capy.position.y + 1.0, -20.6)
    return 'moved'
  })
  await page.waitForTimeout(2500)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(900)

  out.boardFocusables = await page.evaluate(() => {
    const jr = document.querySelector('.capyui-jr')
    if (!jr) return null
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(jr.querySelectorAll(sel)).slice(0, 26).map(e => ({
      tag: e.tagName, cls: (e.className || '').slice(0, 26),
      txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
      dis: !!e.disabled, hidden: !!e.hidden, off: !e.offsetParent,
      aria: e.getAttribute('aria-label')
    }))
  })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  out.pauseFocusables = await page.evaluate(() => {
    const pz = document.querySelector('.capyui-pause')
    if (!pz) return null
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(pz.querySelectorAll(sel)).map(e => ({
      tag: e.tagName, cls: (e.className || '').slice(0, 24),
      txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26),
      hidden: !!e.hidden, off: !e.offsetParent,
      aria: e.getAttribute('aria-label')
    }))
  })

  // open the quit confirm and list again
  out.askFocusables = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.capyui-pause button'))
    const q = btns.find(b => (b.textContent || '').trim() === 'quit to the title')
    if (q) q.click()
    return 'clicked'
  })
  await page.waitForTimeout(600)
  out.askList = await page.evaluate(() => {
    const pz = document.querySelector('.capyui-pause')
    const ask = document.querySelector('.capyui-pauseask')
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return {
      askHidden: ask ? !!ask.hidden : null,
      inAsk: ask ? Array.from(ask.querySelectorAll(sel)).map(e => ({ txt: (e.textContent || '').trim().slice(0, 24), off: !e.offsetParent })) : null,
      whole: Array.from(pz.querySelectorAll(sel)).map(e => ({
        txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
        hidden: !!e.hidden, off: !e.offsetParent, inAsk: !!(ask && ask.contains(e))
      }))
    }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p2-dom.json', { method: 'POST', body: s })
  }, out)
}
