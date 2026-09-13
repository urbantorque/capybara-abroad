async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = {}
  for (const name of ['venice', 'cave', 'kowloon']) {
    out[name] = await page.evaluate(async (name) => {
      const g = window.__capy, r = g.renderer
      const rec = { renders: [], compileMs: -1, progBefore: r.info.programs.length }
      const oc = r.compile.bind(r)
      r.compile = function (a, b, c) { const t = performance.now(); const m = oc(a, b, c); rec.compileMs = +(performance.now() - t).toFixed(0); rec.progAfterCompile = r.info.programs.length; rec.mats = m.size; return m }
      const op = g.post.render.bind(g.post)
      let n = 0
      g.post.render = function () { const t = performance.now(); op(); const ms = performance.now() - t; if (g.biome.current === name && n < 6) { n++; rec.renders.push({ ms: +ms.toFixed(0), progs: r.info.programs.length, hold: g.state.renderHold, sinceGo: +(performance.now() - rec.goAt).toFixed(0) }) } }
      const oa = g.hud.cross
      const t0 = performance.now()
      g.hud.cross(name)
      rec.goAt = t0
      await new Promise(res => setTimeout(res, 9000))
      r.compile = oc; g.post.render = op
      rec.warmMs = g.state.warmMs; rec.warmN = g.state.warmN; rec.progEnd = r.info.programs.length; rec.rung = g.state.perfRung
      return rec
    }, name)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l6-split.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
