async page => {
  // WHERE THE MAIN THREAD GOES WHILE WALKING: a CDP CPU profile over 6 s of W in each chapter,
  // self time by function (top 24) and inclusive time for the game's own entry points.
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
  const names = ['goreme', 'hanoi', 'pantanal', 'kowloon', 'sydney']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.hud.cross(name) }, n)
    await page.waitForTimeout(6000)
    await page.keyboard.down('KeyW')
    await cdp.send('Profiler.start')
    await page.waitForTimeout(6000)
    const { profile } = await cdp.send('Profiler.stop')
    await page.keyboard.up('KeyW')
    const byId = new Map(); for (const nd of profile.nodes) byId.set(nd.id, nd)
    const parent = new Map(); for (const nd of profile.nodes) if (nd.children) for (const c of nd.children) parent.set(c, nd.id)
    const key = (cf) => (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1)
    const self = new Map(), incl = new Map(); const dt = profile.timeDeltas, samples = profile.samples; let total = 0
    for (let i = 0; i < samples.length; i++) {
      const d = (dt[i] || 0) / 1000; total += d
      const k0 = key(byId.get(samples[i]).callFrame); self.set(k0, (self.get(k0) || 0) + d)
      let id = samples[i]; const seen = new Set()
      while (id !== undefined) { const k = key(byId.get(id).callFrame); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + d) } id = parent.get(id) }
    }
    const top = (m, n, f) => [...m.entries()].filter(([k]) => !f || f(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +(v / total * 100).toFixed(1)])
    out[n] = { totalMs: +total.toFixed(0), self: top(self, 26), incl: top(incl, 40, k => /systems\.js|main\.js|npc\.js|capybara\.js|props\.js|environment\.js|weather\.js|goreme|hanoi|pantanal|kowloon|quay|condor/.test(k)) }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7-walk-prof.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
