async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, r = g.renderer, props = r.properties
    const rec = {}
    const oc = r.compile.bind(r)
    let matsAtCompile = null
    r.compile = function (a, b, c) { const m = oc(a, b, c); matsAtCompile = new Map(); m.forEach(x => { const p = props.get(x).currentProgram; matsAtCompile.set(x, p ? p.cacheKey : null) }); return m }
    const op = g.post.render.bind(g.post)
    let done = false
    g.post.render = function () {
      const before = props && matsAtCompile ? Array.from(matsAtCompile.keys()).map(x => (props.get(x).currentProgram || {}).cacheKey) : null
      op()
      if (g.biome.current === 'cave' && !done && matsAtCompile) {
        done = true
        rec.diffs = []
        matsAtCompile.forEach((k0, m) => {
          const p = props.get(m).currentProgram; const k1 = p ? p.cacheKey : null
          if (k0 !== k1 && rec.diffs.length < 6) {
            // find differing tokens
            const a = String(k0).split(','), b = String(k1).split(',')
            const d = []
            for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) d.push([i, a[i], b[i]])
            rec.diffs.push({ mat: m.type + ':' + (m.name || m.uuid.slice(0, 6)), n: d.length, d: d.slice(0, 8) })
          }
        })
        rec.changed = Array.from(matsAtCompile.entries()).filter(([m, k0]) => { const p = props.get(m).currentProgram; return (p ? p.cacheKey : null) !== k0 }).length
        rec.total = matsAtCompile.size
        const ls = []; g.scene.traverseVisible(o => { if (o.isLight) ls.push(o.type + (o.castShadow ? '*' : '')) }); rec.lightsAfter = ls
      }
    }
    const ls0 = []
    g.hud.cross('cave')
    await new Promise(res => setTimeout(res, 2500))
    g.scene.traverseVisible(o => { if (o.isLight) ls0.push(o.type + (o.castShadow ? '*' : '')) }); rec.lightsDuringHold = ls0
    rec.fog = g.scene.fog ? g.scene.fog.type : null
    await new Promise(res => setTimeout(res, 8000))
    r.compile = oc; g.post.render = op
    return rec
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=l6-keys.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
