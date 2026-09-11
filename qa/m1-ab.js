async page => {
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  // Trap 40: `.capyui-go` is the only reliable door, and on a file that did not
  // clear there are TWO of them (the carry-on card's is `.alt`). Assert, and
  // try the other one rather than measuring a title card for four minutes.
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  if (!out.started) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2500)
    out.started = await page.evaluate(() => window.__capy.state.started)
  }
  if (!out.started) {
    await page.evaluate(async () => {
      await fetch('/shot?name=m1-ab.json', { method: 'POST',
        body: btoa(unescape(encodeURIComponent(JSON.stringify({ started: false })))) })
    })
    return
  }
  // The eleven that share the dome AND have a sysCLOUD row, plus three controls
  // that must come back at exactly 0.00: two with no row (Kyoto's overcast IS
  // its light, Iceland is a night) and one that owns its own sky (Sydney).
  for (const b of ['pasto', 'quay', 'cali', 'rio', 'sahara', 'venice', 'palawan',
                   'manly', 'pantanal', 'antarctic', 'hanoi',
                   'kyoto', 'iceland', 'sydney']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    // Walk, then stand: the settled lens is the frame this is for, and it only
    // opens out once the animal has stopped (sysREST_T).
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2600)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(10000)
    // FREEZE THE WORLD FIRST, and this is the whole validity of the pair.
    // The first cut took the two shots 700 ms apart with everything running,
    // and the difference it measured was the harbour water, the ferry and two
    // pedestrians — 86% of the top band "covered" in a frame with no sky in it
    // at all. `state.paused` is main.js's own gate: it skips world.step and
    // every biome update, and systems.js goes on running so the camera holds
    // its pose. With it set, the ONLY thing that differs between the two
    // exposures is the layer's `visible`.
    await page.evaluate(() => { window.__capy.state.paused = true })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'qa/m1ab-' + b + '-on.png' })
    await page.evaluate(() => {
      window.__capy.scene.traverse(function (o) {
        if (o.isInstancedMesh && o.renderOrder === -19) o.visible = false
      })
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'qa/m1ab-' + b + '-off.png' })
    await page.evaluate(() => {
      window.__capy.scene.traverse(function (o) {
        if (o.isInstancedMesh && o.renderOrder === -19) o.visible = true
      })
      window.__capy.state.paused = false
    })
    out.rows.push(await page.evaluate(() => ({ cur: window.__capy.biome.current })))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m1-ab.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
