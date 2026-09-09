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
      for (const m of ms) for (const nd of m.addedNodes) if (nd.textContent) window.__said.push(nd.textContent)
    })
    if (wrap) window.__mo.observe(wrap, { childList: true, subtree: true })
    window.__run = async a => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      if (a.best !== null) g.record(a.id, a.best)
      await sleep(300)
      window.__said.length = 0
      g.recordLive(a.id, 0)
      await sleep(120)
      g.recordLive(a.id, a.val)
      // NO recordEnd and NO further recordLive: the stale watchdog closes it,
      // which is how nine of the fifty-six actually end.
      await sleep(3200)
      return { tag: a.tag, said: window.__said.slice() }
    }
  })
  const res = []
  const cases = [
    // 'uji-run' is lower-better: set a best of 40, then miss it by 1.2 and let
    // the WATCHDOG close the attempt. This is the path v51 never exercised —
    // its staleClose case used a figure that beat the best and correctly
    // stayed silent, so the branch was untested.
    { tag: 'stale-nearmiss-lower', id: 'uji-run', best: 40, val: 41.2, wait: 13000 },
    { tag: 'stale-toofar-lower', id: 'uji-run', best: null, val: 47, wait: 13000 },
    // and a HIGHER-better row with a count unit, to prove recGapUnit prints a
    // bare number rather than "2 of the six off your best".
    { tag: 'stale-nearmiss-count', id: 'yacht-race', best: 5, val: 4, wait: 13000 },
    // ...and a metres row, which must keep its unit.
    { tag: 'stale-nearmiss-metres', id: 'first-dive', best: 12, val: 11.3, wait: 500 },
  ]
  for (const c of cases) {
    res.push(await page.evaluate(a => window.__run(a), c))
    await page.waitForTimeout(c.wait)
  }
  await page.evaluate(o => fetch('/shot?name=v53near.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), res)
}
