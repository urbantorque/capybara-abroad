async page => {
  // L5 M1 — THE PARTY BUS: ten hazards (seven cables, three banners) in
  // route order; the band LEANS a second out from a banner; a banner is
  // cleared on the far side of the roof and knocks you flat on its own side;
  // the festoon comes up with the night. The animal is put on the roof at
  // chiva-local x and the bus is jumped along the route.
  // qa/l5-chiva.json; frames qa/l5-chiva-banner.png, qa/l5-chiva-night.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('cali') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const dbg = () => page.evaluate(() => window.__capy.cali.chivaDebug())
  out.wires = await page.evaluate(() => window.__capy.cali.wireList())
  // onto the roof, and she pulls away after 1.3 s
  await page.evaluate(() => window.__capy.cali.roofPlace(0))
  await page.waitForTimeout(3500)
  out.rolling = await dbg()
  const banners = out.wires.filter(w => w.banner)
  // ---- banner one (side +1): the clear side is local x = +1 ---------------
  const run = async (b, lx, tag) => {
    await page.evaluate(s => window.__capy.cali.chivaSet({ s: s, state: 'rolling', v: 0 }), b.s - 16)
    await page.waitForTimeout(250)
    await page.evaluate(x => window.__capy.cali.roofPlace(x), lx)
    await page.waitForTimeout(250)
    await page.evaluate(x => window.__capy.cali.roofPlace(x), lx)
    await page.evaluate(() => window.__capy.cali.chivaSet({ v: 3 }))
    const rows = []
    let shot = false
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(150)
      // held at the rail, as a hand on A/D would: the roof carry drifts a passenger across a corner
      await page.evaluate(x => { const g = window.__capy, c = g.cali.chivaDebug(), b = g.capy.body
        const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), px = b.position.x - c.x, pz = b.position.z - c.z
        const lxNow = px * cs - pz * sn, e = x - lxNow
        // a lateral nudge only, along local +x = (cos, -sin); the carry is left alone
        b.position.x += e * cs; b.position.z -= e * sn
        b.previousPosition.x += e * cs; b.previousPosition.z -= e * sn
        b.interpolatedPosition.x += e * cs; b.interpolatedPosition.z -= e * sn }, lx)
      const d = await dbg()
      const cp = await page.evaluate(() => { const g = window.__capy, c = g.cali.chivaDebug(), p = g.capy.position
        const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw)
        return { y: +p.y.toFixed(2), onRoof: c.onRoof, lx: +(dx * cs - dz * sn).toFixed(2), lz: +(dx * sn + dz * cs).toFixed(2) } })
      rows.push({ s: d.s, lean: d.lean, clear: d.clearScore, hits: d.hits, capyY: cp.y, onRoof: cp.onRoof, lx: cp.lx, lz: cp.lz })
      if (!shot && d.s > b.s - 6 && tag === 'clear') { shot = true; await page.screenshot({ path: 'qa/l5-chiva-banner.png', timeout: 90000 }) }
      if (d.s > b.s + 8) break
    }
    return rows
  }
  out.clearRun = await run(banners[0], 1.0, 'clear')
  await page.waitForTimeout(1500)
  out.hitRun = await run(banners[1], 1.0, 'hit')
  // ---- the night: to the top, and the festoon ------------------------------
  await page.evaluate(() => { const c = window.__capy.cali; c.chivaSet({ s: c.chivaDebug().len * 0.75, state: 'rolling', v: 0 }) })
  await page.waitForTimeout(250)
  await page.evaluate(() => { const c = window.__capy.cali; c.roofPlace(0); c.chivaSet({ v: 3 }) })
  await page.waitForTimeout(3000)
  out.night = await dbg()
  await page.screenshot({ path: 'qa/l5-chiva-night.png', timeout: 90000 })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-chiva.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
