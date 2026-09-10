async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { rows: [] }
  const CASES = [
    ['sahara',    'noCover',  { x: -20, y: 0.4, z: -40 }],
    ['sahara',    'noPart',   { x: -20, y: 0.4, z: -40 }],
    ['hanoi',     'noJam',    { x: 1,   y: 2.6, z: 40 }],
    ['palawan',   'noHunt',   { x: 8,   y: -3,  z: -18 }],
    ['pantanal',  'noHunt',   { x: -34, y: 1.2, z: -70 }],
    ['antarctic', 'noHunt',   { x: 24,  y: 6,   z: 70 }],
    ['goreme',    null,       { x: 12,  y: 8,   z: 30 }],
    ['manly',     'noCarve',  { x: 0,   y: 1.0, z: 8 }],
    ['cali',      null,       { x: 30,  y: 0.4, z: 40 }],
  ]
  for (const [biome, flag, at] of CASES) {
    const r = await page.evaluate(async o => {
      const g = window.__capy
      g.biome.switchTo(o.biome)
      const sp = g.biome.spawnOf(o.biome)
      g.capy.body.position.set(sp.x, sp.y, sp.z)
      await new Promise(r => setTimeout(r, 2200))
      // Frame time is measured from rAF deltas, which is what the player feels.
      const sample = async (cut) => {
        if (o.flag) g.state[o.flag] = cut
        g.capy.body.position.set(o.at.x, o.at.y, o.at.z)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 1400))     // settle
        const ts = []
        await new Promise(res => {
          let last = performance.now(), n = 0
          const step = () => {
            const now = performance.now()
            ts.push(now - last); last = now; n++
            if (n < 160) requestAnimationFrame(step); else res()
          }
          requestAnimationFrame(step)
        })
        ts.sort((a, b) => a - b)
        const med = ts[ts.length >> 1]
        const p95 = ts[Math.floor(ts.length * 0.95)]
        return { med: Math.round(med * 100) / 100, p95: Math.round(p95 * 100) / 100 }
      }
      const on = await sample(false)
      const off = o.flag ? await sample(true) : null
      if (o.flag) g.state[o.flag] = false
      return { biome: o.biome, flag: o.flag, on, off,
               tris: g.renderer.info.render.triangles,
               calls: g.renderer.info.render.calls }
    }, { biome, flag, at })
    out.rows.push(r)
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-perf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
