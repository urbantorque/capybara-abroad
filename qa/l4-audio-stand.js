async page => {
  // qa/tune-audio.js shape: 90 s standing still in Sydney, every game.sfx call
  // tallied; the rule is nothing NON-POSITIONAL over volume 0.4.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)
  await page.evaluate(() => {
    const g = window.__capy
    window.__tally = {}; window.__loud = []
    const raw = g.sfx
    g.sfx = function (name, opts) {
      const placed = !!(opts && (opts.at || typeof opts.x === 'number'))
      const v = opts && typeof opts.volume === 'number' ? opts.volume : 1
      const k = name + (placed ? ' @placed' : ' @mono') + ' vol~' + v.toFixed(2)
      window.__tally[k] = (window.__tally[k] || 0) + 1
      if (!placed && v > 0.4 && !(opts && opts.ui)) window.__loud.push(k)
      return raw.call(g, name, opts)
    }
  })
  await page.waitForTimeout(90000)
  const out = await page.evaluate(() => {
    const t = window.__tally || {}
    const rows = Object.keys(t).map(k => [k, t[k]]).sort((a, b) => b[1] - a[1])
    const g = window.__capy
    return { biome: g.biome.current, rows: rows.map(r => r[0] + ' x' + r[1]), total: rows.reduce((s, r) => s + r[1], 0),
             loudMono: window.__loud, mover: g.hud.moverAudit().rows.filter(r => r.live).map(r => ({ key: r.key, gain: r.gain, send: r.send, d: r.d })), err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=l4-audio-stand.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
