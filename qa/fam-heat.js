async page => {
  // ---------------------------------------------------------------------------
  // qa/fam-heat.js — DOES A CROSS SQUARE WARM TO YOU SLOWER? (item 3)
  //
  // The second half of the interlock: `fam` earns at half rate while
  // `placeHeat` here is at or over npcPHOTO_HEAT. It is one multiplier, which
  // is exactly the kind of claim that ships unmeasured and turns out to be
  // multiplying by something that is always 1.
  //
  // Same chapter, same spot, two forty-second stretches in one session —
  // `forceHeat` is the differential lever npc.js already publishes for this.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(11000)
  // ---- SETTLE BEFORE MEASURING ANYTHING --------------------------------
  // The first cut ran the cold stretch straight after the crossing and got
  // 0.493 against a hot 0.575 — the wrong way round — because `game.calm()` is
  // still climbing out of the arrival for the first half-minute and the fam
  // rise is MULTIPLIED by it. The two stretches were not comparable: one of
  // them started in a world that had just been built. Thirty seconds of
  // nothing, and then both are measured in the same settled world.
  await page.evaluate(() => new Promise(r => setTimeout(r, 30000)))

  async function stretch(hot) {
    // Wipe familiarity so the two stretches start from the same place.
    await page.evaluate((h) => {
      const g = window.__capy
      const live = g.biome.current
      for (const L of (g.locals || [])) if (L && L.biome === live) L.fam = 0
      g.forceHeat(h ? 1 : 0)
    }, hot)
    await page.evaluate(() => new Promise(r => setTimeout(r, 40000)))
    return page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      const p = g.capy.position
      let best = 0
      for (const L of (g.locals || [])) {
        if (L && L.biome === live) best = Math.max(best, L.fam || 0)
      }
      return { fam: +best.toFixed(3),
               heat: +g.placeHeat(p.x, p.z).toFixed(2),
               calm: +(+(typeof g.calm === 'function' ? g.calm(p.x, p.z) : -1)).toFixed(2) }
    })
  }

  // Both orders, because an order effect is exactly what the first cut of
  // this measured. If cold-then-hot and hot-then-cold agree, the ratio is the
  // multiplier; if they do not, it is the settling world again.
  const cold = await stretch(false)
  const hot = await stretch(true)
  const hot2 = await stretch(true)
  const cold2 = await stretch(false)
  await page.evaluate(() => { window.__capy.forceHeat(-1) })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=fam-heat.json', { method: 'POST', body: s })
  }, { cold: cold, hot: hot, hot2: hot2, cold2: cold2, errs: errs })
}
