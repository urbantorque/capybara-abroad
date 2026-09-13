async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 240)) })
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 240)))
  const hostile = []
  for (const [tag, file] of [['tasks5', '{"v":1,"tasks":5,"seen":[0],"biome":"venice"}'], ['nanms', '{"v":1,"tasks":["wheek"],"seen":[1,10],"ms":1e309,"biome":"kowloon"}'], ['badstow', '{"v":1,"tasks":["wheek"],"seen":[1,10],"ms":5000,"biome":"venice","stow":{"kind":"dragon","from":"nowhere"}}'], ['biomeUnknown', '{"v":1,"tasks":["wheek"],"seen":[1],"ms":5000,"biome":"atlantis"}'], ['seenHuge', '{"v":1,"tasks":["wheek"],"seen":[1,99,-4,2.5,"x"],"ms":5000,"biome":"venice","nb":{"venice":{"d":123,"f":"no"}}}']]) {
    // the game flushes its live file on unload, so the hostile file goes in AT THE TITLE (not started), then one reload
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(800)
    await page.evaluate((f) => { try { localStorage.removeItem('capy3.journey.broken.v1') } catch (e) {} localStorage.setItem('capy3.journey.v1', f) }, file)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    const card = await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); const b = document.querySelector('.capyui-go'); return { carry: c ? c.textContent.trim().slice(0, 60) : null, go: b ? b.textContent.trim().slice(0, 40) : null, keys: Object.keys(localStorage) } })
    await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(8000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const keys = Object.keys(localStorage)
      let raw = null; try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) {}
      let bad = null; try { bad = localStorage.getItem('capy3.journey.broken.v1') } catch (e) {}
      return { started: g && g.state.started, biome: g && g.biome.current, keys, rawNow: raw ? raw.slice(0, 120) : null, badNow: bad ? bad.slice(0, 80) : null, lastError: g && g.state.lastError || null, err: document.querySelector('#err') ? document.querySelector('#err').textContent.slice(0, 120) : null, toasts: [...document.querySelectorAll('.capyui-toast')].map(e => e.textContent.trim().slice(0, 90)), pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }
    })
    hostile.push(Object.assign({ tag, card }, r, { errsSoFar: errs.length }))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-save2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { hostile, errs: errs.slice(0, 30), errN: errs.length })
}
