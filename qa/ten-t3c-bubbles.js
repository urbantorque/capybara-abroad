async page => {
  // T3c, noBubbleCap: the most speech bubbles drawn at once over 60 s of hand
  // clock at three places — the Sydney lawn by the spawn, the Sahara crest (the
  // marquee point), and the Uji bridge (the River Run start) — counted from the
  // DOM (display block, opacity over 0.05), not from the cap's own number. Then
  // 30 s at each with the flag cut, for the number the cap takes away.
  // One place per call, in that order: the done list is in sessionStorage,
  // which survives the reloads a long run-code sometimes suffers.
  const NAME = 'ten-t3c-bubbles'
  const PORT = 5193
  const SITES = {
    sydney: { at: null },                  // the spawn, asked of the biome (19.5 m from the steps: cap 1)
    lawn: { at: [30, 26], biome: 'sydney' }, // the gardens lawn, 38 m from the steps: cap 2
    sahara: { at: [262, 50] },             // 13 m short of the crest marquee (275, 55)
    kyoto: { at: [4, 122] },               // under the Uji bridge, marquee (4, 128)
  }
  page.setDefaultNavigationTimeout(120000)
  const done = await page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('t3c-bub') || '[]') } catch (e) { return [] } })
  const site = ['sydney', 'lawn', 'sahara', 'kyoto'].find(s => done.indexOf(s) < 0) || 'sydney'
  const place = SITES[site].biome || site
  const cur = await page.evaluate(() => window.__capy && window.__capy.state.started ? window.__capy.biome.current : '')
  if (cur !== place) {
    if (!cur) {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
      await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(7000)
      await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(7000)
    }
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === place) break
      await page.evaluate(s => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(s) }, place); await page.waitForTimeout(11000)
    }
  }
  const out = { site, biome: await page.evaluate(() => window.__capy.biome.current) }
  const run = async (secs, cut, tag) => {
    await page.evaluate(o => {
      const g = window.__capy
      g.state.noBubbleCap = o.cut
      if (typeof g.bubbleCapReset === 'function') g.bubbleCapReset()
      window.__t3c = { peak: 0, hist: [0, 0, 0, 0, 0], sub: 0, capOne: 0, n: 0 }
    }, { cut })
    const chunks = Math.ceil(secs * 30 / 150)
    for (let c = 0; c < chunks; c++) {
      await page.evaluate(o => {
        const g = window.__capy, b = g.capy.body, w = window.__t3c
        let at = o.at
        if (!at) { const sp = g.biome.spawnOf(g.biome.current); at = [sp.x, sp.z] }
        const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current]
        const h = api && api.terrainHeight ? api.terrainHeight(at[0], at[1]) : 0
        for (let i = 0; i < 150; i++) {
          if (i % 30 === 0) { b.position.set(at[0], h + 0.6, at[1]); b.velocity.set(0, 0, 0) }
          g.tick(1 / 30, false)
          let n = 0
          const els = document.querySelectorAll('.capynpc-bubble')
          for (const el of els) if (el.style.display === 'block' && +el.style.opacity > 0.05) n++
          w.hist[Math.min(4, n)]++
          if (n > w.peak) w.peak = n
          const a = g.bubbleCapAudit ? g.bubbleCapAudit() : null
          if (a && a.sub) w.sub++
          if (a && a.cap === 1) w.capOne++
          w.n++
        }
      }, { at: SITES[site].at })
    }
    out[tag] = await page.evaluate(() => Object.assign({}, window.__t3c,
      { audit: window.__capy.bubbleCapAudit ? window.__capy.bubbleCapAudit() : null,
        speech: (() => { const s = window.__capy.speechAudit ? window.__capy.speechAudit().counts : {}; return s })(),
        rung: window.__capy.state.perfRung }))
  }
  await run(60, false, 'live')
  await page.screenshot({ path: 'qa/' + NAME + '-' + site + '.png' })
  await run(30, true, 'cut')
  await page.evaluate(() => { window.__capy.state.noBubbleCap = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(s => { try { const d = JSON.parse(sessionStorage.getItem('t3c-bub') || '[]'); d.push(s); sessionStorage.setItem('t3c-bub', JSON.stringify(d)) } catch (e) {} }, site)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME + '-' + site, out })
}
