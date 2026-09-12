async page => {
  // qa/l4r-writing-play.js — minutes 2..10 of a new player's Sydney, directed:
  // the concert (the chapter's marquee), the journal (Tab), the pause card
  // (Esc), the journey, then the wharf and the departures board. Logs every
  // text surface every 2 s; screenshots at the beats.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(3000)
  const log = []
  const snap = async (tag) => { log.push(await page.evaluate((tag) => {
    const q = s => [...document.querySelectorAll(s)]
    const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' }
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const g = window.__capy
    return { tag, t: performance.now() / 1000,
      paper: q('.capyui-todo').filter(vis).map(txt)[0] || '',
      toasts: q('.capyui-toast').filter(vis).map(txt).filter(Boolean),
      other: q('[class^=capyui-]').filter(e => vis(e) && !e.closest('.capyui-todo') && !e.classList.contains('capyui-toast') && e.children.length === 0).map(txt).filter(s => s && s.length < 400),
      done: g.hud.tasksDone(), pos: [g.capy.position.x.toFixed(1), g.capy.position.y.toFixed(1), g.capy.position.z.toFixed(1)] }
  }, tag)) }
  const put = (x, z) => page.evaluate(([x, z]) => {
    const g = window.__capy; const b = g.capy.body
    b.position.set(x, 1.6, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [x, z])
  const shot = (n) => page.screenshot({ path: 'qa/l4r-writing-p-' + n + '.png' })
  const wait = async (ms, tag) => { const n = Math.ceil(ms / 2000); for (let i = 0; i < n; i++) { await page.waitForTimeout(Math.min(2000, ms - i * 2000)); await snap(tag) } }

  await wait(2000,'start')
  // 2. the journal
  await page.keyboard.press('Tab'); await page.waitForTimeout(1200); await snap('journal'); await shot('20-journal')
  await page.keyboard.press('Tab'); await page.waitForTimeout(600)
  // 3. pause, settings, journey
  await page.keyboard.press('Escape'); await page.waitForTimeout(1000); await snap('pause'); await shot('30-pause')
  const st = await page.$('.capyui-pause.show button:has-text("settings")'); if (st) { await st.click(); await page.waitForTimeout(900); await snap('settings'); await shot('31-settings') }
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  const jn = await page.$('.capyui-pause.show button:has-text("journey")'); if (jn) { await jn.click(); await page.waitForTimeout(900); await snap('journey'); await shot('32-journey') }
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  await snap('resumed')
  // 4. the wharf
  await put(-40, -21)
  await wait(3000, 'wharf'); await shot('40-wharf')
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(700)
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(700)
  await page.keyboard.press('KeyQ'); await wait(4000, 'board'); await shot('41-board')
  const board = await page.evaluate(() => {
    const q = s => [...document.querySelectorAll(s)]
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    return q('.capyui-jr button, .capyui-jr [class*=tile], .capyui-jr li').filter(vis).map(e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), dis: e.disabled || e.getAttribute('aria-disabled') || e.className }))
  })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=l4r-writing-play.json', { method: 'POST', body: s })
  }, { log, board, errs })
}
