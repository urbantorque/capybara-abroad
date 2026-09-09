async page => {
  const out = {}
  await page.setViewportSize({ width: 1280, height: 720 })

  // ---- no pad: the clues must still name keys ----
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)
  out.keyboard = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.capyui-todo li')).map(li => {
      const c = null
      return { task: (li.childNodes[0] ? li.textContent : '').trim().replace(/\s+/g, ' ').slice(0, 34),
               clue: c ? c.textContent.trim() : null }
    })
    return { rows: rows, clue: (document.querySelector('.capyui-clue')||{}).textContent || null }
  })

  // ---- with a pad ----
  await page.addInitScript(() => {
    window.__pad = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0] }
    const mk = () => ({
      index: 0, id: 'p2-fake-pad (STANDARD GAMEPAD)', connected: true,
      mapping: 'standard', timestamp: performance.now(),
      axes: window.__pad.axes.slice(),
      buttons: window.__pad.buttons.map(v => ({ pressed: v > 0.5, touched: v > 0.1, value: v }))
    })
    navigator.getGamepads = () => [mk(), null, null, null]
    window.__tap = async (i, ms) => {
      window.__pad.buttons[i] = 1
      await new Promise(r => setTimeout(r, ms || 130))
      window.__pad.buttons[i] = 0
      await new Promise(r => setTimeout(r, 150))
    }
  })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(5000)
  // nudge the stick so padPoll certainly ran and padSeen latched
  await page.evaluate(async () => {
    window.__pad.axes[0] = 0.9
    await new Promise(r => setTimeout(r, 500))
    window.__pad.axes[0] = 0
    await new Promise(r => setTimeout(r, 400))
  })
  await page.waitForTimeout(1200)
  out.pad = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.capyui-todo li')).map(li => {
      const c = null
      return { task: li.textContent.trim().replace(/\s+/g, ' ').slice(0, 34),
               clue: c ? c.textContent.trim() : null }
    })
    return { rows: rows, clue: (document.querySelector('.capyui-clue')||{}).textContent || null }
  })

  // and the way-out prompt, which is the other string that names a control
  out.prompt = await page.evaluate(() => {
    const e = document.querySelector('.capyui-home')
    return e ? e.textContent.trim() : null
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p2-words.json', { method: 'POST', body: s })
  }, out)
}
