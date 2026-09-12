async page => {
  // qa/l4r-writing-open.js — a NEW player's first 90 s: fresh save, click Begin,
  // log every piece of text the game shows (paper, toasts, bubbles, marquee,
  // chain row) every 2 s, screenshot every 15 s.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'qa/l4r-writing-00-title.png' })
  // the extras fold on the title
  const extras = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,summary,details')].map(e => e.textContent.trim()).filter(Boolean)
    return b
  })
  // click Begin like a person
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l4r-writing-01-begin.png' })
  const log = []
  const seen = new Set()
  const snap = async (t) => page.evaluate((t) => {
    const q = s => [...document.querySelectorAll(s)]
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const g = window.__capy
    return {
      t,
      paper: q('.capyui-todo').map(txt)[0] || '',
      marq: q('.capyui-marq.on').map(txt)[0] || '',
      toasts: q('.capyui-toast').map(txt).filter(Boolean),
      bubbles: q('.capyui-bubble, .capyui-say, [class*=bubble]').map(txt).filter(Boolean),
      chain: q('[class*=chain], [class*=ladder]').map(txt).filter(Boolean),
      cards: q('.capyui-card, .capyui-moment, .capyui-banner, [class*=card]').map(txt).filter(Boolean),
      pos: g && g.capy && g.capy.body ? [g.capy.body.position.x.toFixed(1), g.capy.body.position.z.toFixed(1)] : null,
      done: g && g.hud && g.hud.tasksDone ? g.hud.tasksDone() : null
    }
  }, t)
  const t0 = Date.now()
  let lastShot = 0
  // A wandering new player: wheek once because the paper said so, then walk
  // about in short legs, hop now and then, press E near things.
  const keys = ['KeyW', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyW']
  let ki = 0
  await page.keyboard.press('KeyQ')
  while (Date.now() - t0 < 90000) {
    const k = keys[ki++ % keys.length]
    await page.keyboard.down(k)
    await page.waitForTimeout(1400)
    await page.keyboard.up(k)
    if (ki % 3 === 0) await page.keyboard.press('Space')
    if (ki % 4 === 0) await page.keyboard.press('KeyE')
    const t = Math.round((Date.now() - t0) / 100) / 10
    const s = await snap(t)
    log.push(s)
    if (t - lastShot >= 15) { lastShot = t; await page.screenshot({ path: 'qa/l4r-writing-t' + Math.round(t) + '.png' }) }
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=l4r-writing-open.json', { method: 'POST', body: s })
  }, { extras, log, errs })
}
