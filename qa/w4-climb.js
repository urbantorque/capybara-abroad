async page => {
  // w4-climb: can a player climb the Mong Kok scaffold to the roof? Stand at
  // the foot of the face, hold E and push into it for twenty seconds.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const out = { rows: [] }
  await page.evaluate(() => window.__capy.biome.switchTo('kowloon')); await page.waitForTimeout(3000)
  const fx = await page.evaluate(() => { const g = window.__capy; const h = g.kowloon.climbHold(-20, 5, 0); return h ? 1 : 0 })
  out.holdSeen = fx
  // hkSCAF.x = -hkFACE; find the face by probing x from -30 to 0 at y 5
  const face = await page.evaluate(() => { const g = window.__capy; for (let x = -40; x < 10; x += 0.5) { if (g.kowloon.climbHold(x, 5, 0)) return x } return null })
  out.faceX0 = face
  await page.evaluate((x) => { const g = window.__capy; const b = g.capy.body; b.position.set(x + 3.2, 0.6, 0); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, face)
  await page.waitForTimeout(800)
  const keyFor = async (wx, wz) => page.evaluate(([wx, wz]) => { const cy = window.__capy.input.camYaw || 0; const rel = Math.atan2(wx, wz) - cy - Math.PI; const c = Math.cos(rel), s = Math.sin(rel); return c > 0.38 ? 'KeyW' : c < -0.38 ? 'KeyS' : s > 0 ? 'KeyA' : 'KeyD' }, [wx, wz])
  await page.keyboard.down('KeyE')
  let key = await keyFor(-1, 0)
  await page.keyboard.down(key)
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(400)
    const k2 = await keyFor(-1, 0)
    if (k2 !== key) { await page.keyboard.up(key); key = k2; await page.keyboard.down(key) }
    const r = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), climbing: !!g.capy.climbing, stam: +(g.capy.stamina !== undefined ? g.capy.stamina : -1).toFixed(2), blown: !!g.capy.blown } })
    out.rows.push(r)
    if (i === 20) await page.screenshot({ path: 'qa/w4-climb-mid.png' })
  }
  await page.keyboard.up(key); await page.keyboard.up('KeyE')
  await page.screenshot({ path: 'qa/w4-climb-end.png' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w4climb.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
