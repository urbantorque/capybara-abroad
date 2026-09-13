async page => {
  const cases = [
    { tag: 'wrongTypes', save: { v: 1, tasks: 5, seen: 'abc', recs: 'x', recg: null, ms: 'NaN', chapms: [], finds: {}, foundAt: 3, inc: 'q', scn: [], pho: null, fed: 1, pas: 'z', lin: true, biome: 'nowhere' } },
    { tag: 'nanNumbers', save: { v: 1, tasks: ['sydney.spill', 'notatask', 42, null], seen: [1, 99, -3, 'x'], recs: { 'sydney.spill': { v: 'NaN', at: -1 } }, ms: -1e99, chapms: { 1: 1e309, 2: -5 }, finds: ['nope'], inc: { 1: 1e12 }, scn: { 1: -7 }, pho: { 1: 'many' }, fed: { 99: 3 }, biome: 'venice' } },
    { tag: 'hugeTasks', save: { v: 1, tasks: Array.from({ length: 5000 }, (_, i) => 'task' + i), seen: Array.from({ length: 5000 }, (_, i) => i), biome: 'kowloon' } },
  ]
  const results = []
  for (const c of cases) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(5000)
    await page.evaluate((s) => { try { localStorage.clear(); localStorage.setItem('capy3.journey.v1', JSON.stringify(s)) } catch (e) {} }, c.save)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(7000)
    const title = await page.evaluate(() => ({ has: !!window.__capy, running: !!window.__capyRunning, err: (document.getElementById('err') || {}).textContent || '',
      carry: !!document.querySelector('.capyui-carry'), go: !!document.querySelector('.capyui-go'),
      bad: (function () { try { return localStorage.getItem('capy3.journey.bad') } catch (e) { return 'ERR' } })() }))
    await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
    await page.waitForTimeout(8000)
    const after = await page.evaluate(() => {
      const g = window.__capy
      const p = g && g.capy ? g.capy.position : { x: NaN, y: NaN, z: NaN }
      return { started: !!(g && g.state.started), biome: g && g.biome ? g.biome.current : null, lastError: g ? (g.state.lastError || null) : 'nogame',
        pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], done: g && g.hud ? g.hud.tasksDone() : null,
        err: (document.getElementById('err') || {}).textContent.slice(0, 300) || '' }
    })
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW')
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(1500)
    await page.screenshot({ path: 'qa/l6r-qa-save-' + c.tag + '.png' })
    const journal = await page.evaluate(() => {
      const g = window.__capy
      return { paused: !!g.state.paused, lastError: g.state.lastError || null, err: (document.getElementById('err') || {}).textContent.slice(0, 300) || '' }
    })
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(500)
    results.push({ tag: c.tag, title, after, journal })
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-save.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, results)
}
