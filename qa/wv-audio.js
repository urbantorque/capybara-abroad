async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(640, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['venice','kowloon']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      const P = { venice:[-8,1.4,-22], kowloon:[0,1.4,10] }[name] || [sp.x,sp.y,sp.z]
      b.position.set(P[0], P[1], P[2]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      window.__sfxSeen = {}
      const orig = g.sfx
      g.sfx = function (nm, o) { window.__sfxSeen[nm] = (window.__sfxSeen[nm]||0)+1; return orig.call(g, nm, o) }
    }, n)
    // real rAF, real audio clock, 45 s
    await page.evaluate(() => new Promise(r => setTimeout(r, 22000)))
    await page.evaluate(() => new Promise(r => setTimeout(r, 22000)))
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      return { sfx: window.__sfxSeen, music: !!(g.music && g.music.playing),
               beats: g.music ? +g.music.beats().toFixed(1) : null,
               err: g.state.lastError || null }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wv.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
