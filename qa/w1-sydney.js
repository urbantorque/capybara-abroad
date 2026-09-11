async page => {
  // w1-sydney: the Opera House concert. Fresh save, start, walk onto the
  // podium by teleport, wheek three times, and read the concert's audit,
  // the signpost's live line and the task.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(6000)
  const out = {}
  const read = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const g = window.__capy
    return { biome: g.biome.current, started: g.state.started,
             marqOn: !!document.querySelector('.capyui-marq.on'),
             cls: (document.querySelector('.capyui-marq') || {}).className,
             head: q('.capyui-marqhead'), name: q('.capyui-marqname'), txt: q('.capyui-marqtxt'),
             live: q('.capyui-marqlive'), say: q('.capyui-marqsay'),
             bar: (document.querySelector('.capyui-marqbar i') || { style: {} }).style.width,
             audit: g.env && g.env.concertAudit ? g.env.concertAudit() : null,
             done: g.taskDone ? g.taskDone('opera-stage') : null,
             toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent),
             err: g.state.lastError || null }
  })
  out.before = await read()
  await page.screenshot({ path: 'qa/w1-sydney-card.png', clip: { x: 0, y: 0, width: 460, height: 460 } })
  // onto the podium
  await page.evaluate(() => {
    const g = window.__capy; const b = g.capy.body
    b.position.set(0, 1.6, 2.5); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(1500)
  out.onStage = await read()
  for (let k = 0; k < 3; k++) {
    await page.keyboard.down('KeyQ'); await page.waitForTimeout(160); await page.keyboard.up('KeyQ')
    await page.waitForTimeout(k === 0 ? 9000 : 2500)
    out['note' + (k + 1)] = await read()
    if (k === 0) await page.screenshot({ path: 'qa/w1-sydney-house.png' })
  }
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/w1-sydney-cheer.png' })
  await page.waitForTimeout(3000)
  out.after = await read()
  await page.screenshot({ path: 'qa/w1-sydney-after.png', clip: { x: 0, y: 0, width: 460, height: 460 } })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1sydney.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
