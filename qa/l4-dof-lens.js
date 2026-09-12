async page => {
  // L4 E1 (a1) — the defocus row on the driving lens, in photo mode and in
  // slow motion. Sydney: read post.params.dof settled; press K and read it
  // again after the lens has opened; leave photo mode; call game.slowmo and
  // read it mid-moment and after. Target: driving <= 0.30, photo >= 0.60,
  // slow-mo >= 0.55 within 0.5 s, back under 0.30 after it ends.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty' (a1): the perf governor under load is not the picture
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const rd = () => page.evaluate(() => { const g = window.__capy, P = g.post.params
    return { dof: +P.dof.toFixed(3), far0: +P.dofFar0.toFixed(1), far1: +P.dofFar1.toFixed(1), ts: +g.state.timeScale.toFixed(2), photo: !!(g.hud && g.hud.photoAudit && g.hud.photoAudit().on) } })
  const out = { biome: await page.evaluate(() => window.__capy.biome.current) }
  out.driving = await rd()
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(2500)
  out.photo = await rd()
  await page.screenshot({ path: 'qa/l4-dof-lens-photo.png' })
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(2500)
  out.afterPhoto = await rd()
  await page.evaluate(() => window.__capy.slowmo(0.55, 1.6))
  await page.waitForTimeout(500)
  out.slow05 = await rd()
  await page.waitForTimeout(700)
  out.slow12 = await rd()
  await page.screenshot({ path: 'qa/l4-dof-lens-slow.png' })
  await page.waitForTimeout(3500)
  out.afterSlow = await rd()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l4-dof-lens.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
