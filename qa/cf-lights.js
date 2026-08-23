async page => {
  await page.reload(); await page.waitForTimeout(5200)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name); await sleep(900)
      const L = []
      g.scene.traverse(o => {
        if (!o.isLight) return
        let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        L.push({ t: o.type, nm, vis, i: +o.intensity.toFixed(2),
                 d: o.distance !== undefined ? Math.round(o.distance) : -1,
                 p: [Math.round(o.position.x), Math.round(o.position.y), Math.round(o.position.z)] })
      })
      const liveL = L.filter(l => l.vis)
      const byType = {}
      for (const l of liveL) byType[l.t] = (byType[l.t] || 0) + 1
      return { n: L.length, live: liveL.length, byType, list: liveL.slice(0, 30) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=lights.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
