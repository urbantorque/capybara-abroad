async page => {
  // q2-hud: pictures of the paper and the bottom-left corner after the
  // labelling pass, plus the DOM text so the words can be asserted.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(9500)
  const read = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const vis = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).opacity !== '0' }
    return { biome: window.__capy.biome.current,
             marqOn: !!document.querySelector('.capyui-marq.on'), marqHead: q('.capyui-marqhead'), marqTxt: q('.capyui-marqtxt'),
             part: q('.capyui-part'), partShown: vis('.capyui-part'), kick: q('.capyui-kick'),
             count: q('.capyui-count'), finds: q('.capyui-finds'),
             stamLbl: q('.capyui-stamlbl'), stamShown: vis('.capyui-stamlbl'), pipsLbl: q('.capyui-pipslbl'),
             toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent),
             titles: Array.from(document.querySelectorAll('.capyui-task:not(.capyui-hidden) [title]')).map(e => e.title) }
  })
  const out = {}
  out.sydney = await read()
  await page.screenshot({ path: 'qa/q2-sydney.png' })
  // Cali, at the spot in the report: the lawn by the bridge
  await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('cali')
    const b = g.capy.body; b.position.set(-30, 0.8, -30); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(6000)
  out.cali = await read()
  await page.screenshot({ path: 'qa/q2-cali.png' })
  // ...and running, so the puff label is up
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(2200)
  out.caliRun = await read()
  await page.screenshot({ path: 'qa/q2-cali-run.png' })
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(400)
  // the corner, close up
  await page.screenshot({ path: 'qa/q2-corner.png', clip: { x: 0, y: 700, width: 420, height: 100 } })
  await page.screenshot({ path: 'qa/q2-card.png', clip: { x: 0, y: 0, width: 440, height: 420 } })
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=q2hud.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
