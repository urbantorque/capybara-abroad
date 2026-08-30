async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    window.__said = []
    const wrap = document.querySelector('.capyui-toasts')
    window.__mo = new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        if (nd.textContent) window.__said.push(nd.textContent)
      }
    })
    if (wrap) window.__mo.observe(wrap, { childList: true, subtree: true })
    window.__hasWrap = !!wrap
    window.__run = async a => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      if (a.best !== null) g.record('uji-run', a.best)
      await sleep(300)
      window.__said.length = 0
      g.recordLive('uji-run', 0)
      await sleep(120)
      g.recordLive('uji-run', a.val)
      await sleep(120)
      if (a.how === 'end') g.recordEnd('uji-run')
      else await sleep(2800)
      await sleep(400)
      return { tag: a.tag, said: window.__said.slice() }
    }
  })
  const res = []
  const cases = [
    { tag: 'firstEver', best: null, val: 41.5, how: 'end', wait: 500 },
    { tag: 'setBest', best: 40, val: 40, how: 'end', wait: 13000 },
    { tag: 'nearMiss', best: null, val: 41.5, how: 'end', wait: 13000 },
    { tag: 'tooFar', best: null, val: 48, how: 'end', wait: 13000 },
    { tag: 'beat', best: null, val: 38, how: 'end', wait: 13000 },
    { tag: 'staleClose', best: null, val: 39.6, how: 'stale', wait: 500 },
  ]
  for (const c of cases) {
    res.push(await page.evaluate(a => window.__run(a), c))
    await page.waitForTimeout(c.wait)
  }
  const board = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), cb = g.capy.body
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
    await sleep(2500)
    const txt = await fetch('/src/shared.js').then(r => r.text())
    const b = txt.slice(txt.indexOf('export const TASKS'), txt.indexOf('export const CHAPTERS'))
    const re = /\{\s*id:\s*'([^']+)'[\s\S]*?chapter:\s*(\d+)/g
    let m
    const ids = []
    while ((m = re.exec(b))) if (Number(m[2]) === 4) ids.push(m[1])
    let doneN = 0
    for (const id of ids) if (g.hud.completeTask(id)) doneN++
    await sleep(1500)
    return { ids: ids.length, doneN,
             tally: document.querySelector('.capyui-count') ? document.querySelector('.capyui-count').textContent : null,
             clue: document.querySelector('.capyui-clue') ? document.querySelector('.capyui-clue').textContent : null,
             uji: g.hud.isTaskDone ? undefined : undefined }
  })
  await page.evaluate(o => fetch('/shot?name=v51b.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { res, board })
}
