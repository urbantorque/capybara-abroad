async page => {
  // WHAT THE BUILD SPENDS ITS TIME ON: a CDP CPU profile over the crossing, self-time by function.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  const names = ['iceland', 'monaco']
  const out = {}
  for (const n of names) {
    await cdp.send('Profiler.start')
    await page.evaluate((name) => { window.__capy.hud.cross(name) }, n)
    await page.waitForTimeout(2500)
    const { profile } = await cdp.send('Profiler.stop')
    // self time per node, aggregated by function+url:line
    const byId = new Map(); for (const nd of profile.nodes) byId.set(nd.id, nd)
    const self = new Map(); const dt = profile.timeDeltas; const samples = profile.samples
    for (let i = 0; i < samples.length; i++) {
      const nd = byId.get(samples[i]); const cf = nd.callFrame
      const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1)
      self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000)
    }
    // ...and inclusive time per node via parent chain, for the chapter's build function
    const parent = new Map(); for (const nd of profile.nodes) if (nd.children) for (const c of nd.children) parent.set(c, nd.id)
    const incl = new Map()
    for (let i = 0; i < samples.length; i++) {
      let id = samples[i]; const seen = new Set()
      while (id !== undefined) { const nd = byId.get(id); const cf = nd.callFrame
        const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1)
        if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + (dt[i] || 0) / 1000) }
        id = parent.get(id) }
    }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => [k, +v.toFixed(1)])
    const topI = [...incl.entries()].filter(([k]) => !/\(root\)|\(program\)|\(idle\)|\(garbage/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, +v.toFixed(1)])
    out[n] = { self: top, incl: topI, ok: await page.evaluate(() => window.__capy.biome.current) }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7-build-prof.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
