async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: await page.evaluate(() => window.__capy.state.started) }
  const start = (name) => page.evaluate((name) => {
    const g = window.__capy; window.__rec = { name, rows: [], t0: performance.now(), on: true }
    const tick = () => {
      if (!window.__rec.on) return
      const a = g.capy.animAudit(); const t = (performance.now() - window.__rec.t0) / 1000
      window.__rec.rows.push({ t: +t.toFixed(3), y: +g.capy.position.y.toFixed(3), pop: +a.pop.toFixed(3), land: +a.land.toFixed(3), gr: a.grounded ? 1 : 0, vy: +a.vy.toFixed(2),
        headX: +a.headX.toFixed(2), earZ: +a.earZ.toFixed(2), tail: +a.tail.toFixed(3), mood: +a.mood.toFixed(2), eye: +a.eyeOpen.toFixed(3), my: +a.modelY.toFixed(3), pitch: +a.pitch.toFixed(3),
        breath: +a.breath.toFixed(4), lean: +a.lean.toFixed(3), speed: +a.speed.toFixed(2), air: +a.airPose.toFixed(2) })
      requestAnimationFrame(tick)
    }
    tick()
  }, name)
  const stop = () => page.evaluate(() => { window.__rec.on = false; return window.__rec.rows })
  await page.waitForTimeout(3000)
  out.fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(+(n / 2).toFixed(1)) }; f() }))
  // THE JUMP from standing
  await start('jump'); await page.waitForTimeout(300); await page.keyboard.press('Space'); await page.waitForTimeout(2000); out.jump = await stop()
  await page.waitForTimeout(800)
  // THE RUNNING JUMP: hold W 1.5 s, Space, keep W 1.5 s
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500)
  await start('runjump'); await page.waitForTimeout(300); await page.keyboard.press('Space'); await page.waitForTimeout(1800); out.runjump = await stop()
  await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
  // THE WHEEK
  await start('wheek'); await page.waitForTimeout(300); await page.keyboard.press('KeyQ'); await page.waitForTimeout(1500); out.wheek = await stop()
  await page.waitForTimeout(1000)
  // THE GRAB (whiff)
  await start('grab'); await page.waitForTimeout(300); await page.keyboard.press('KeyE'); await page.waitForTimeout(1200); out.grab = await stop()
  await page.waitForTimeout(500)
  // THE STOP: run then release
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000)
  await start('stop'); await page.waitForTimeout(300); await page.keyboard.up('KeyW'); await page.waitForTimeout(1500); out.stop = await stop()
  await page.evaluate((o) => fetch('/shot?name=l6r-art-anim2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
