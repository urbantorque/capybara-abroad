async page => {
  // L4 F1a — THE CAMERA. Pasto from the picker on a fresh file, K, then:
  // the world held (a local's position identical across two seconds, the
  // clock not advancing), A held for a second (orbit moves), 3 (50 mm), a
  // click on the canvas centre (focus set, dof >= 0.6 after the lens opens),
  // Q twice (loaf), Enter (a 960-wide album entry), K away (un-paused,
  // the live rig back). Frames: qa/l4cam-{open,orbit,loaf}.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(9000)
  const A = () => page.evaluate(() => window.__capy.hud.photoAudit())
  const npc = () => page.evaluate(() => { const g = window.__capy; const n = (g.npcs || []).find(r => r && r.group); return n ? [+n.group.position.x.toFixed(3), +n.group.position.z.toFixed(3), +g.state.time.toFixed(2)] : null })
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  out.before = await A()
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(2500)
  out.open = await A()
  out.npc0 = await npc()
  await page.screenshot({ path: 'qa/l4cam-open.png', timeout: 90000 })
  await page.keyboard.down('KeyA'); await page.waitForTimeout(1100); await page.keyboard.up('KeyA')
  await page.waitForTimeout(400)
  out.orbit = await A()
  out.npc1 = await npc()
  await page.keyboard.press('Digit3')
  await page.mouse.click(640, 420)
  await page.waitForTimeout(1600)
  out.focus = await A()
  await page.screenshot({ path: 'qa/l4cam-orbit.png', timeout: 90000 })
  await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ')
  await page.waitForTimeout(900)
  out.loaf = await A()
  out.loafPose = await page.evaluate(() => { const a = window.__capy.capy.animAudit ? window.__capy.capy.animAudit() : null; return a ? { modelY: a.modelY, headX: a.headX, earZ: a.earZ } : null })
  await page.screenshot({ path: 'qa/l4cam-loaf.png', timeout: 90000 })
  const albN0 = await page.evaluate(() => window.__capy.hud.albumAudit().n)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  out.album = await page.evaluate(() => { const a = window.__capy.hud.albumAudit(); return { n: a.n, last: a.last } })
  out.albN0 = albN0
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(3000)
  out.closed = await A()
  out.npc2 = await npc()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l4-camera.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
