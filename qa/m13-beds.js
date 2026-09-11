async page => {
  // m13-beds.js — IS THERE ANYTHING CONTINUOUS IN THIS CHAPTER?
  //
  // `moverAudit()` is the only window on a Web Audio graph, which is otherwise
  // write-only. The two numbers that matter are `built` (a graph exists) and
  // `live` (it is inside sysMOVER_MAX and over the cull) — a handle that is
  // built and not live is a bed nobody can hear, and the two read identically
  // from outside without this.
  //
  // Run with real keys and a real clock: an sfxMover wired but never stepped is
  // exactly the failure this is for, and a hand-driven tick loop never unlocks
  // the AudioContext.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  const list = ['sahara', 'cali', 'pantanal', 'palawan', 'pasto',
                'manly', 'venice', 'iceland', 'goreme', 'cave', 'drift']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    // Walk, so the distance term has something to do and a bed that is pinned
    // to the animal rather than to the world shows up as a flat gain.
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3000)
    const near = await page.evaluate(() => {
      const g = window.__capy
      const a = g.hud.moverAudit ? g.hud.moverAudit() : null
      if (!a) return null
      return (a.rows || []).map(r => ({ key: r.key, built: !!r.built, live: !!r.live,
                                        gain: +(r.gain || 0).toFixed(3),
                                        d: +(r.d || 0).toFixed(1) }))
    })
    await page.waitForTimeout(4000)
    await page.keyboard.up('KeyW')
    const far = await page.evaluate(() => {
      const g = window.__capy
      const a = g.hud.moverAudit ? g.hud.moverAudit() : null
      if (!a) return null
      return (a.rows || []).map(r => ({ key: r.key, gain: +(r.gain || 0).toFixed(3),
                                        d: +(r.d || 0).toFixed(1) }))
    })
    out.rows.push({ cur: await page.evaluate(() => window.__capy.biome.current),
                    near: near, far: far,
                    err: await page.evaluate(() => window.__capy.state.lastError
                      ? String(window.__capy.state.lastError).slice(0, 120) : null) })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m13-beds.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
