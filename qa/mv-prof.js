async page => {
  const KEY = { sydney: 'Digit1', kowloon: 'Minus', venice: 'Digit0', pantanal: 'BracketRight' }
  const rows = []
  for (const name of ['sydney', 'venice', 'kowloon', 'pantanal']) {
    await page.reload()
    await page.waitForTimeout(6500)
    await page.keyboard.press(KEY[name])
    await page.waitForTimeout(7000)
    await page.keyboard.down('w')
    await page.keyboard.down('Shift')
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      const raw = g.tick
      const cpu = []
      const frame = []
      g.tick = function (dt, render) {
        const a = performance.now()
        const out = raw.call(g, dt, render)
        cpu.push(performance.now() - a)
        return out
      }
      let last = performance.now()
      let n = 0
      function f () {
        const t = performance.now()
        frame.push(t - last); last = t; n++
        if (n < 400) requestAnimationFrame(f)
        else {
          g.tick = raw
          const info = g.renderer.info
          res({ cpu: cpu, frame: frame, biome: g.biome.current,
                calls: info.render.calls, tris: info.render.triangles,
                progs: info.programs ? info.programs.length : -1,
                geom: info.memory.geometries, tex: info.memory.textures })
        }
      }
      requestAnimationFrame(f)
    }))
    await page.keyboard.up('w')
    await page.keyboard.up('Shift')
    const st = a => { const s = a.slice(40).sort((x, y) => x - y); return s }
    const c = st(r.cpu), fr = st(r.frame)
    const q = (a, p) => +a[Math.floor(a.length * p)].toFixed(2)
    rows.push({ biome: r.biome, calls: r.calls, tris: r.tris, geom: r.geom, tex: r.tex, progs: r.progs,
                cpu50: q(c, 0.5), cpu90: q(c, 0.9), cpu99: q(c, 0.99), cpuMax: +c[c.length - 1].toFixed(1),
                fr50: q(fr, 0.5), fr90: q(fr, 0.9), fr99: q(fr, 0.99), frMax: +fr[fr.length - 1].toFixed(1) })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-prof.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
