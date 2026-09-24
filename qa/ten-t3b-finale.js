async page => {
  // T3b, the end. Run after ten-t3b-cold on the same page (no reload: the feeding is the
  // session's). Cross to Sydney, put the animal in the horseshoe's middle, raise the ring
  // flag and send 'finale:staged' as sysFinaleStage does. The bird must land in the mouth,
  // sit facing the animal, carry a yuzu if it was fed, and go when the ring comes down.
  const NAME = 'ten-t3b-finale'
  const out = {}
  if (await page.evaluate(() => window.__capy.biome.current) !== 'sydney') {
    await page.evaluate(() => { window.__capy.hud.cross('sydney') }); await page.waitForTimeout(11000)
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.sit = await page.evaluate(() => {
    const g = window.__capy, sp = g.biome.spawnOf('sydney'), X = 30, Z = 26
    const open = Math.atan2(sp.z - Z, sp.x - X)
    const b = g.capy.body; b.position.set(X, g.groundY(X, Z) + 0.6, Z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 20; i++) g.tick(1 / 30, false)
    g.state.finaleOn = true
    g.events.emit('finale:staged', { x: X, z: Z, r: 2.6, mouth: open })
    const seen = []
    for (let i = 0; i < 300; i++) { g.tick(1 / 30, false); const s = g.rivalAudit().state; if (seen[seen.length - 1] !== s) seen.push(s); if (s === 'sit' && g.rivalAudit().t > 2) break }
    const a = g.rivalAudit(), p = g.capy.position
    const r = Math.hypot(a.at[0] - X, a.at[2] - Z), ang = Math.atan2(a.at[2] - Z, a.at[0] - X)
    const face = Math.atan2(p.x - a.at[0], p.z - a.at[2])
    const s = g.scene.getObjectByName('rivalIbis'); let beak = false; s.traverse(o => { if (o.isMesh && o.visible && o.geometry && o.geometry.parameters && o.geometry.parameters.radius === 0.075) beak = true })
    window.__open = open
    return { seen, audit: a, rFromCentre: +r.toFixed(2), offMouth: +Math.abs(Math.atan2(Math.sin(ang - open), Math.cos(ang - open))).toFixed(2),
             faceErr: +Math.abs(Math.atan2(Math.sin(face - a.yaw), Math.cos(face - a.yaw))).toFixed(2), yuzuInBeak: beak, fed: a.fed }
  })
  await page.evaluate(async n => {
    // the coda's own lens: in the mouth, looking in (sysFinCodaYaw = PI/2 - open)
    const g = window.__capy, X = 30, Z = 26, o = window.__open, y = g.groundY(X, Z)
    g.camera.position.set(X + Math.cos(o) * 7.5, y + 3.2, Z + Math.sin(o) * 7.5); g.camera.lookAt(X, y + 0.6, Z); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  }, NAME + '-sit')
  out.after = await page.evaluate(() => {
    const g = window.__capy; g.state.finaleOn = false
    const seen = []
    for (let i = 0; i < 150; i++) { g.tick(1 / 30, false); const s = g.rivalAudit().state; if (seen[seen.length - 1] !== s) seen.push(s); if (s === 'off') break }
    return { seen, seat: g.rivalAudit().seat }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
