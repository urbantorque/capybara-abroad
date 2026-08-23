async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['venice','kowloon']) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      const api = g[name]
      const r = { }
      // run one whole clock cycle at speed and watch the set pieces fire
      let maxLit = 0, showSeen = 0, tideMax = 0, boardsMax = 0, oro = 0, pig = 0
      for (let i = 0; i < 14000; i++) {
        g.tick(1/60, false)
        if (name === 'kowloon') {
          maxLit = Math.max(maxLit, api.litTowers())
          showSeen = Math.max(showSeen, api.show())
        } else {
          tideMax = Math.max(tideMax, api.tide())
          boardsMax = Math.max(boardsMax, api.boardsOut())
          pig = Math.max(pig, api.pigeonsUp())
        }
      }
      r.maxLit = maxLit; r.showSeen = +showSeen.toFixed(2)
      r.tideMax = +tideMax.toFixed(2); r.boardsMax = +boardsMax.toFixed(2); r.pigeonsUp = pig
      r.err = g.state.lastError || null
      return r
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wu.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
