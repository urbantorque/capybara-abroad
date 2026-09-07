async page => {
  // ---------------------------------------------------------------------------
  // qa/saynear.js — DOES ANYBODY ACTUALLY SAY IT? (ROADMAP-FUN, item 1d)
  //
  // `game.sayNear(x, z, r, text)` has to work across the two completely
  // different shapes npc.js keeps its people in: the steering CAST (Sydney and
  // Pasto, `humans`/`paHumans`) and the LOCALS (the other seventeen). The first
  // attempt at this lived in systems.js and tested `r.biome`/`r.fig` on
  // `game.npcs` — fields those records do not have — so it returned false in
  // all nineteen and the feature was dead while looking alive.
  //
  // Five chapters: two cast, two locals, and Sơn Đoòng, which has nobody and
  // must answer FALSE so the caller's fallback fires. A probe that only tested
  // where it works would not have caught the original bug either.
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'venice', 'monaco', 'cave']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(7000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const p = g.capy.position
      const before = g.npcSpeaker ? g.npcSpeaker() : null
      // A radius wide enough to find somebody from a spawn, and a line nothing
      // else in the game says, so the bubble that comes back is provably this.
      const said = g.sayNear(p.x, p.z, 26, 'MIND THE BOLLARD')
      return { biome: g.biome.current, said: !!said,
               speakerBefore: before && before.text ? before.text : null }
    })
    // The bubble is a DOM element with a life of its own; read it a beat later.
    await page.waitForTimeout(900)
    const seen = await page.evaluate(() => {
      const els = document.querySelectorAll('*')
      let hit = null
      for (const e of els) {
        if (e.children.length === 0 && e.textContent === 'MIND THE BOLLARD') {
          const rc = e.getBoundingClientRect()
          hit = { cls: e.className, w: Math.round(rc.width), h: Math.round(rc.height) }
          break
        }
      }
      return hit
    })
    rows.push(Object.assign(r, { bubble: seen }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=saynear.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
