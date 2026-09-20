async page => {
  // ROADMAP-WOW2, T — the two files the walk must NOT run on, and the skip.
  //
  //  1. RESTORE WITH ONE TASK DONE: a fresh file, Begin, the wheek row ticked
  //     through the game's own completeTask, the save written by the game's
  //     own saveFlush (the pagehide listener), then a reload WITHOUT clearing
  //     storage and Carry On. Count every `.capyui-toast.tut` that appears in
  //     40 s: must be zero. Also: the old 8 s paper explainer fires here (the
  //     file the walk never ran on) — counted, and it must appear exactly once.
  //  2. ESC AT BEAT THREE: a fresh file again (storage cleared once, by hand,
  //     not by an init script — this script reloads), Begin, walk beat one,
  //     run beat two, and when beat three's pill is up press Escape. The
  //     audit must say done + skipped, the pill must be gone within 0.6 s, and
  //     the save on disk must carry tut: 1.
  //
  // Writes qa/wow2-tut-restore.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}
  async function begin(clear) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(600)
    if (clear) { await page.evaluate(() => { try { localStorage.clear() } catch (e) {} }); await page.goto('http://localhost:5188/') }
    await page.waitForTimeout(5200)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    await page.waitForTimeout(400)
    return page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  }
  async function watchPills() {
    await page.evaluate(() => {
      const L = window.__tutWatch = { tut: [], paper: [], all: 0 }
      const mo = new MutationObserver(ms => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || !n.classList || !n.classList.contains('capyui-toast')) continue
          L.all++
          if (n.classList.contains('tut')) L.tut.push(n.textContent)
          if (/top left is the paper/.test(n.textContent)) L.paper.push(n.textContent)
        }
      })
      mo.observe(document.body, { childList: true, subtree: true })
    })
  }
  // ---- 1. a file with one task done, restored ------------------------------
  out.fresh = { started: await begin(true) }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const g = window.__capy; g.completeTask('wheek'); window.dispatchEvent(new Event('pagehide')) })
  await page.waitForTimeout(800)
  out.fresh.saved = await page.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { tasks: f.tasks, tut: f.tut } } catch (e) { return String(e) } })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  out.restore = {}
  // a file on disk puts CARRY ON on the card (.capyui-carry); .capyui-go is
  // 'Go somewhere else' then, and does not start
  out.restore.button = await page.evaluate(() => { const b = document.querySelector('.capyui-carry'); return b ? b.textContent : null })
  await page.evaluate(() => { const b = document.querySelector('.capyui-carry'); if (b) b.click() })
  await page.waitForTimeout(400)
  out.restore.started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  await watchPills()
  // walk about a bit, so a walk that wrongly armed would have every chance
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1500)
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(2000)
  }
  out.restore.pills = await page.evaluate(() => Object.assign({ audit: window.__capy.tutAudit(), tasksDone: window.__capy.hud.tasksDone() }, window.__tutWatch))
  // ---- 2. Esc at beat three -------------------------------------------------
  out.esc = { started: await begin(true) }
  await watchPills()
  const T0 = Date.now()
  let pill = ''
  while (Date.now() - T0 < 60000) {
    const L = await page.evaluate(() => {
      const e = [...document.querySelectorAll('.capyui-toast.tut')].filter(e => !e.classList.contains('out') && !e.dataset.going)[0]
      return { pill: e ? e.textContent : '', beat: window.__capy.tutAudit().beat }
    })
    pill = L.pill
    if (/Space/.test(pill)) break
    if (/W, A, S, D/.test(pill)) { await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.down('KeyW') }
    else if (/Shift/.test(pill)) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(400) }
    else { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(250) }
  }
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  out.esc.atBeat3 = pill
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(650)
  out.esc.after = await page.evaluate(() => {
    const g = window.__capy
    const live = [...document.querySelectorAll('.capyui-toast.tut')].filter(e => !e.classList.contains('out') && !e.dataset.going).length
    return { audit: g.tutAudit(), livePills: live, paused: g.hud.pauseShown() }
  })
  await page.keyboard.press('Escape')   // resume
  await page.waitForTimeout(1500)
  out.esc.resumed = await page.evaluate(() => ({ pauseShown: window.__capy.hud.pauseShown(), paused: !!window.__capy.state.paused }))
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(500)
  out.esc.saved = await page.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { tut: f.tut, tasks: f.tasks } } catch (e) { return String(e) } })
  // ...and after the skip, no further tutorial pill in 25 s; the old paper
  // line arrives instead (the walk never reached beat six)
  await page.waitForTimeout(32000)
  out.esc.later = await page.evaluate(() => window.__tutWatch)
  await page.evaluate((o) => fetch('/shot?name=wow2-tut-restore.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
