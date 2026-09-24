async page => {
  // T3d, the wood's trunks across a return: biome.attach re-adds every body filed under
  // Kyoto, so the switch has to settle them on the first frame back. Live: all trunks in
  // the world after Kyoto -> Uji-less Sydney -> Kyoto. Flagged before the return: none,
  // and the group hidden. A walk into a first-row trunk is stopped when live.
  const NAME = 'ten-t3d-return'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  const cross = async n => {
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === n) break
      await page.evaluate(c => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(c) }, n)
      await page.waitForTimeout(11000)
    }
    return page.evaluate(() => window.__capy.biome.current)
  }
  out.a = await cross('kyoto')
  out.live0 = await page.evaluate(() => window.__capy.kyoto.toriiWood())
  out.b = await cross('quay')
  out.away = await page.evaluate(() => window.__capy.kyoto.toriiWood())
  out.c = await cross('kyoto')
  out.live1 = await page.evaluate(() => window.__capy.kyoto.toriiWood())
  await page.evaluate(() => { window.__capy.state.noToriiWood = true })
  out.d = await cross('quay')
  out.e = await cross('kyoto')
  await page.waitForTimeout(1000)
  out.cut1 = await page.evaluate(() => window.__capy.kyoto.toriiWood())
  await page.evaluate(() => { window.__capy.state.noToriiWood = false })
  await page.waitForTimeout(1000)
  out.back = await page.evaluate(() => window.__capy.kyoto.toriiWood())
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
