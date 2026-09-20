async page => {
  // Same session, same live page as wow3-d6-jacaranda.js — no reload, no
  // re-entry. Just re-forces the gust (it will have decayed since the last
  // run-code call ended) and grabs a screenshot at a moment burstAudit()
  // reports live slots, so the airborne purple motes are actually on
  // screen rather than caught between bursts.
  const out = {}
  await page.evaluate(async () => {
    const g = window.__capy
    const y = g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight
      ? g[g.biome.current].terrainHeight(6, 24.5) : 1.2
    g.capy.body.position.set(6, y + 1.2, 24.5)
    g.capy.body.velocity.setZero()
    g.weather.set('sydney', { gust: { base: 3.0, swing: 0, hz: 0.15 } })
    g.hud.front(0)
  })
  await page.waitForTimeout(3500)
  let got = false
  for (let i = 0; i < 60 && !got; i++) {
    await page.waitForTimeout(150)
    const a = await page.evaluate(() => { const a = window.__capy.weather.burstAudit(); return { alive: a.alive, born: a.born, hi: a.hi } })
    out.lastAudit = a
    if (a.alive > 5) {
      got = true
      await page.screenshot({ path: 'qa/wow3-d6-jacaranda-burst.png' })
    }
  }
  out.got = got
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow3-d6-jacaranda-shot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
