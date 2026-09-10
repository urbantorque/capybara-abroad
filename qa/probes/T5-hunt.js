async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }

  // ======================= ANTARCTICA: the skua ==========================
  out.skua = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const sp = g.biome.spawnOf('antarctic')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
    const A = g.antarctic
    if (!A || !A.skuaDebug) return { missing: true }
    const strike = async (mode) => {
      g.state.noHunt = (mode === 'cut')
      // A flush decays at 1.2/s and the strike is at u 0.618. Winding to 0.40
      // and flushing there put the wheek five and a half seconds before the
      // stoop, by which time the flush was long under the 0.35 threshold —
      // which is correct behaviour and a useless experiment.
      A.skuaTo(mode === 'spoil' ? 0.585 : 0.40)
      await new Promise(r => setTimeout(r, 300))
      if (mode === 'spoil') A.skuaFlush()
      const pre = A.skuaDebug()
      let peakDisplay = 0, peakCallR = -1, lowY = 999
      const t0 = Date.now()
      while (Date.now() - t0 < 9000) {
        await new Promise(r => setTimeout(r, 110))
        const d = A.skuaDebug()
        if (d.displaying > peakDisplay) peakDisplay = d.displaying
        if (d.callR > peakCallR) peakCallR = d.callR
        if (d.y !== null && d.y < lowY) lowY = d.y
      }
      const post = A.skuaDebug()
      g.state.noHunt = false
      return { mode, took: post.took, saved: post.saved, nest: pre.nest,
               peakDisplay, peakCallR: Math.round(peakCallR * 10) / 10,
               lowY: Math.round(lowY * 100) / 100 }
    }
    const clean = await strike('clean')
    const spoiled = await strike('spoil')
    const cut = await strike('cut')
    const clean2 = await strike('clean')
    return { clean, spoiled, cut, clean2, nests: A.skuaDebug().nests }
  })

  // ========================= PALAWAN: the terns ==========================
  out.tern = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const sp = g.biome.spawnOf('palawan')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
    const P = g.palawan
    if (!P || !P.ternDebug) return { missing: true }
    const sweep = async (hunt, ms) => {
      g.state.noHunt = !hunt
      let deepest = -99, peakHit = 0, sSum = 0, sN = 0, sMax = 0, oMax = 0
      const t1 = Date.now()
      while (Date.now() - t1 < ms) {
        await new Promise(r => setTimeout(r, 110))
        // hold the animal well away so its own open-push is not in the numbers
        g.capy.body.position.set(60, 1, 40)
        const d = P.ternDebug()
        if (d.underWaterBy > deepest) deepest = d.underWaterBy
        if (d.hitK > peakHit) peakHit = d.hitK
        sSum += d.spread; sN++
        if (d.spread > sMax) sMax = d.spread
        if (d.maxOff > oMax) oMax = d.maxOff
      }
      return { deepestUnderWater: Math.round(deepest * 100) / 100,
               peakHitK: Math.round(peakHit * 1000) / 1000,
               meanSpread: Math.round((sSum / sN) * 1000) / 1000,
               maxSpread: Math.round(sMax * 1000) / 1000,
               maxFishPush: Math.round(oMax * 1000) / 1000 }
    }
    const hunting = await sweep(true, 16000)
    const cut = await sweep(false, 16000)
    g.state.noHunt = false
    return { hunting, cut, ballY: P.ternDebug().ballY }
  })

  // ========================= PANTANAL: the onça ==========================
  out.jag = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    const sp = g.biome.spawnOf('pantanal')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
    const J = g.pantanal
    if (!J || !J.jaguarDebug) return { missing: true }
    const hunt = async (spoil) => {
      // reset her, put the herd on the crossing, and stand well back
      g.biome.switchTo('sydney')
      await new Promise(r => setTimeout(r, 500))
      g.biome.switchTo('pantanal')
      await new Promise(r => setTimeout(r, 1200))
      J.herdToCrossing()
      J.forceJaguar()
      g.capy.body.position.set(-34, 2, -70)
      const seen = []
      let peakScatter = 0, sawStalk = false, sawRush = false, spoiledAt = null
      let d0x = -34, d0z = -70
      const t0 = Date.now()
      while (Date.now() - t0 < 74000) {
        await new Promise(r => setTimeout(r, 200))
        // follow her along the bank at about twenty metres, which is what a
        // player who has spotted a stalk actually does. Parking at the
        // crossing put the wheek 35.8 m away against a 34 m range.
        g.capy.body.position.set(d0x, 2, d0z)
        g.capy.body.velocity.set(0, 0, 0)
        const d = J.jaguarDebug()
        d0x = d.x + 4; d0z = d.z + 19
        if (d.st === 'stalk') sawStalk = true
        if (d.st === 'rush') sawRush = true
        if (d.scattered > peakScatter) peakScatter = d.scattered
        if (seen.indexOf(d.st) < 0) seen.push(d.st)
        if (spoil && d.st === 'stalk' && d.u > 0.12 && spoiledAt === null) {
          window.__capy.input.honkPressed = true
          spoiledAt = d.u
          await new Promise(r => setTimeout(r, 400))
        }
        if (d.st === 'away' && sawStalk) break
      }
      const fin = J.jaguarDebug()
      return { seen, sawStalk, sawRush, peakScatter, spoiledAt,
               runs: fin.runs, spoiledN: fin.spoiled }
    }
    const a = await hunt(false)
    const b = await hunt(true)
    return { clean: a, spoiled: b }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T5-hunt.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
