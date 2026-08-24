// PAYOFF batch 1, job 2: WHAT RADIUS MAKES OWNERSHIP EXIST?
//
// The same measurement the pair-chat radius got (4.6 m was a radius at which
// that feature did not exist; 13 m was). For every chapter: the distance from
// each prop's HOME to the nearest local who can walk, and how many distinct
// owners you get at each candidate radius.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                 'cave', 'antarctic']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const W = g.locals.filter(r => r.biome === live && r.fig)
      const all = g.locals.filter(r => r.biome === live)
      const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
        (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
      const ds = []
      for (const p of props) {
        let bd = 1e9
        for (const r of W) {
          const dx = p.homeX - r.ax, dz = p.homeZ - r.az
          const d2 = dx * dx + dz * dz
          if (d2 < bd) bd = d2
        }
        if (bd < 1e9) ds.push(Math.sqrt(bd))
      }
      ds.sort((a, c) => a - c)
      const at = R => {
        const own = new Set()
        let np = 0
        for (const p of props) {
          for (const r of W) {
            const dx = p.homeX - r.ax, dz = p.homeZ - r.az
            if (dx * dx + dz * dz < R * R) { own.add(r); np++; break }
          }
        }
        return [own.size, np]
      }
      const row = { locals: all.length, walkers: W.length, props: props.length,
                    nearest: ds.slice(0, 6).map(v => +v.toFixed(1)), at: {} }
      for (const R of [5.5, 8, 11, 14, 18, 24]) row.at['r' + R] = at(R)
      return row
    }, n)
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=pfownr.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
