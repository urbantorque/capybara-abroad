async page => {
  // rd-people.js — the limbs, judged by eye, at the lens the game now uses.
  //
  // The agent that built them framed them close. This asks the question that
  // actually matters: do they read as people at the distance a player sees
  // them from, in the four chapters with the biggest crowds — and does the
  // draw-call cost land where it was reported.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const TAG = 'after'
  const out = { tag: TAG, rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  for (const b of ['sydney', 'sahara', 'kowloon', 'venice', 'pasto', 'hanoi']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    // walking, so the gait is live, then settled so the lens opens out
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2400)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(10500)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      const i = g.renderer.info.render
      return { cur: g.biome.current, calls: i.calls, tris: i.triangles,
               err: g.state.lastError || null,
               npcs: (g.npcs || []).length }
    }))
    await shot('people-' + TAG + '-' + b)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-people-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
