async page => {
  // THE BASELINE FOR D7 — how much life each of the nineteen chapters has, and
  // of what kind, before any of area 3's remaining systems are built.
  //
  // Five columns, one per item on the D7 line:
  //   locals   people registered here (reactAudit) — the "one-person chapter"
  //            count the roadmap asserts is five
  //   herd     recruitable animal kinds (herdDebug)
  //   amb      what the place said in a 24 s sample, by voice
  //   acts     how many movements the chapter declares
  //   inst     InstancedMeshes in the scene with a count over 12 — a crude but
  //            reload-stable proxy for "there is a flock in here"
  //
  // One page.goto per chapter: the picker keys are the TITLE CARD's and pressing
  // nineteen of them in play opens the help card nineteen times (harness trap 15).
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(6000)
    await page.evaluate(() => { window.__capy.hud.ambAudit(true) })
    await page.waitForTimeout(24000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const ra = g.reactAudit ? g.reactAudit() : null
      const hd = g.herdDebug ? g.herdDebug() : null
      const amb = g.hud.ambAudit()
      let inst = 0
      g.scene.traverse(o => { if (o.isInstancedMesh && o.count > 12 && o.visible) inst++ })
      const bio = g.biome.current
      return {
        biome: bio,
        locals: ra ? ra.locals : -1,
        herd: hd && hd.kinds ? hd.kinds.map(k => k.kind + ':' + k.n).join(' ') : String(hd && hd.length),
        amb: amb.tally, ambN: amb.total,
        inst: inst,
      }
    })
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-life.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
