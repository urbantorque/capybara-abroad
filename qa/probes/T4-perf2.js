async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { rows: [] }
  const CASES = [
    ['sahara',    'noCover', { x: -20, y: 0.4, z: -40 }, true],
    ['sahara',    'noPart',  { x: -20, y: 0.4, z: -40 }, true],
    ['hanoi',     'noJam',   { x: 1,   y: 2.6, z: 40 },  false],
    ['palawan',   'noHunt',  { x: 8,   y: -3,  z: -18 }, false],
    ['pantanal',  'noHunt',  { x: -34, y: 1.2, z: -70 }, false],
    ['antarctic', 'noHunt',  { x: 24,  y: 6,   z: 70 },  false],
    ['manly',     'noCarve', { x: 0,   y: 1.0, z: 8 },   false],
  ]
  for (const [biome, flag, at, chase] of CASES) {
    const r = await page.evaluate(async o => {
      const g = window.__capy
      g.biome.switchTo(o.biome)
      const sp = g.biome.spawnOf(o.biome)
      g.capy.body.position.set(sp.x, sp.y, sp.z)
      await new Promise(r => setTimeout(r, 2200))
      if (o.chase && g.sahara && g.sahara.forceChase) g.sahara.forceChase()
      // TIME THE SIMULATION, NOT THE FRAME. Every chapter sits at 16.7 ms
      // because the display is locked to 60 — a term that costs a tenth of a
      // millisecond is invisible there. game.tick(dt, false) runs the whole
      // update with rendering off, which is the number a new per-frame loop
      // actually adds to.
      const sample = async (cut) => {
        if (o.flag) g.state[o.flag] = cut
        g.capy.body.position.set(o.at.x, o.at.y, o.at.z)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 900))
        for (let w = 0; w < 40; w++) g.tick(1 / 60, false)   // warm
        const ts = []
        for (let k = 0; k < 24; k++) {
          const t0 = performance.now()
          for (let n = 0; n < 20; n++) g.tick(1 / 60, false)
          ts.push((performance.now() - t0) / 20)
        }
        ts.sort((a, b) => a - b)
        return Math.round(ts[ts.length >> 1] * 1000) / 1000
      }
      const on = await sample(false)
      const off = o.flag ? await sample(true) : null
      const on2 = await sample(false)
      if (o.flag) g.state[o.flag] = false
      return { biome: o.biome, flag: o.flag, on, off, on2 }
    }, { biome, flag, at, chase })
    out.rows.push(r)
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-perf2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
