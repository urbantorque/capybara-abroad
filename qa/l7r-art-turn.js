async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const rec = (ms) => page.evaluate((ms) => new Promise(res => {
    const g = window.__capy, rows = [], t0 = performance.now()
    const tick = () => {
      const a = g.capy.animAudit()
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(3), yaw: +a.yaw.toFixed(3), speed: +a.speed.toFixed(2), legPhase: +a.legPhase.toFixed(2), lift: a.legLift.map(v => +v.toFixed(2)),
        legX: a.legX.map(v => +v.toFixed(2)), roll: +a.roll.toFixed(3), pitch: +a.pitch.toFixed(3), headX: +a.headX.toFixed(2), lean: +a.lean.toFixed(3), pop: +a.pop.toFixed(3), sqY: +a.sqY.toFixed(3), grounded: a.grounded })
      if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(rows)
    }
    requestAnimationFrame(tick)
  }), ms)
  // 1. a standing turn: A held 1.3 s from rest
  await page.waitForTimeout(2500)
  let p = rec(2600)
  await page.waitForTimeout(300)
  await page.keyboard.down('KeyA'); await page.waitForTimeout(1300); await page.keyboard.up('KeyA')
  out.turn = await p
  // 2. a run and a hard reverse: W 2.5 s then S 1.2 s
  await page.waitForTimeout(1500)
  p = rec(4200)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2400); await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyS'); await page.waitForTimeout(1200); await page.keyboard.up('KeyS')
  out.reverse = await p
  // 3. a running turn: W held, then A tapped 0.8 s while W stays
  await page.waitForTimeout(1500)
  p = rec(4000)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500)
  await page.keyboard.down('KeyA'); await page.waitForTimeout(800); await page.keyboard.up('KeyA')
  await page.waitForTimeout(1200); await page.keyboard.up('KeyW')
  out.runTurn = await p
  await page.evaluate((o) => fetch('/shot?name=l7r-art-turn.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
