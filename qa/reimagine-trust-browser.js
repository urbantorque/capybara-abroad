async page => {
  // Isolated browser/session only: this instrument replaces its local save.
  // Real keys exercise Pause/help; the explicit UI buttons exercise replay.
  // The page's current origin is retained, so any isolated dev port works.
  const origin = new URL(page.url()).origin
  const out = { checks: [], snapshots: {}, errors: [] }
  const check = (label, ok) => {
    out.checks.push({ label, pass: !!ok })
    if (!ok) out.errors.push(label)
  }
  const read = () => page.evaluate(() => ({ tut: window.__capy.tutAudit(),
    paused: window.__capy.state.paused, menu: window.__capy.hud.pauseShown() }))
  const tap = async key => {
    await page.keyboard.down(key); await page.waitForTimeout(120)
    await page.keyboard.up(key); await page.waitForTimeout(150)
  }
  const click = async label => {
    const found = await page.evaluate(text => {
      const b = [...document.querySelectorAll('.capyui-pausebtn')].find(b => !b.hidden && b.textContent === text)
      if (!b) return false
      b.click(); return true
    }, label)
    check('button exists: ' + label, found)
  }
  const start = async restore => {
    await page.waitForFunction(() => !!window.__capy)
    await page.evaluate(restore => document.querySelector(restore ? '.capyui-carry' : '.capyui-go').click(), restore)
    await page.waitForFunction(() => window.__capy.state.started)
  }
  try {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.evaluate(() => localStorage.clear())
    await page.goto(origin + '/')
    await start(false)
    await page.waitForFunction(() => window.__capy.tutAudit().on, null, { timeout: 30000 })
    await tap('Escape')
    const before = out.snapshots.paused = await read()
    await page.waitForTimeout(1100)
    const held = await read()
    check('Pause holds the active lesson', before.menu && held.tut.on && !held.tut.done && held.tut.beat === before.tut.beat)
    check('Pause freezes its timer', held.tut.t === before.tut.t)
    const visibility = await page.evaluate(() => [...document.querySelectorAll('.capyui-pausebtn')]
      .filter(b => /guided walk/.test(b.textContent)).map(b => ({ text: b.textContent, hidden: b.hidden, display: getComputedStyle(b).display })))
    out.snapshots.visibility = visibility
    check('Hidden tutorial button is not rendered', visibility.every(b => b.hidden ? b.display === 'none' : b.display !== 'none'))
    await page.screenshot({ path: 'qa/reimagine-trust-pause.png' })
    await click('the controls')
    await page.waitForTimeout(1100)
    const help = out.snapshots.help = await read()
    check('Control help retains unfinished guidance', help.paused && help.tut.armed && !help.tut.ever && !help.tut.skipped)
    check('Control help freezes its timer', help.tut.t === held.tut.t)
    await tap('Escape')
    await page.waitForTimeout(500)
    const resumed = await read()
    check('Closing help resumes the lesson', !resumed.paused && resumed.tut.armed && resumed.tut.t > help.tut.t)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    const unfinished = await page.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')))
    check('Unfinished guidance is saved as unfinished', unfinished.tut === 0)
    await page.reload()
    await start(true)
    const restored = out.snapshots.restored = await read()
    check('Carry On offers unfinished guidance again', restored.tut.armed && !restored.tut.ever)
    await tap('Escape')
    await click('skip the guided walk')
    const skipped = out.snapshots.skipped = await read()
    check('Explicit skip dismisses guidance', skipped.tut.done && skipped.tut.skipped && skipped.tut.ever)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await page.reload()
    await start(true)
    const skipRestored = await read()
    check('Explicit skip survives reload', !skipRestored.tut.armed && skipRestored.tut.ever)
    await tap('Escape')
    await click('replay the guided walk')
    const replayed = out.snapshots.replayed = await read()
    check('Replay starts fresh guidance without a new journey', replayed.tut.armed && !replayed.tut.ever && replayed.tut.beat === 0)
  } catch (e) {
    out.errors.push(String(e.stack || e))
  }
  await page.evaluate(out => fetch('/shot?name=reimagine-trust-browser.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(out, null, 2))))
  }), out)
  if (out.errors.length) throw Error(out.errors.join('\n'))
}
