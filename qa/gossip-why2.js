async page => {
  // Two oddities in the trace: the six-second wait drained in about half that,
  // and `t` later rose to 8.9 with nothing having armed it. Both would be
  // explained by npc.js's update running more than once a frame — so count it
  // against requestAnimationFrame, and read the timer straight rather than
  // through the published audit.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    // How many modules are in the loop, and is npc in it once?
    const names = (g.__updaters || []).map(m => m.__name)
    // Count rAF ticks against heardAudit's clock over a fixed window with a
    // line armed, which is the only state in which the timer moves.
    g.rumourArm('Nowhere', 'bad')
    const t0 = g.rumourAudit().t
    let frames = 0
    const start = performance.now()
    await new Promise(r => {
      const step = () => { frames++
        if (performance.now() - start < 2000) requestAnimationFrame(step); else r() }
      requestAnimationFrame(step)
    })
    const wall = (performance.now() - start) / 1000
    const t1 = g.rumourAudit().t
    return { names: names, frames: frames, wall: +wall.toFixed(2),
             t0: t0, t1: t1, drained: +(t0 - t1).toFixed(2),
             ratio: +((t0 - t1) / wall).toFixed(2),
             line: g.rumourAudit().line }
  })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=gossip-why2.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs.slice(0, 4) }, out))
}
