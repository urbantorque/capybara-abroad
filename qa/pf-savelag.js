// PAYOFF batch 1: HOW LONG, IN WALL-CLOCK MILLISECONDS, IS THE SAVE LATE?
//
// sysSAVE_DEBOUNCE is 700 ms and it is aged on the SCALED dt, so a tick that
// comes with slow motion on it — which is every `wow`, which is every marquee
// and every chapter close — waits 1/scale times as long. main.js states the
// rule this breaks in its own doctrine block ("THE TIMERS RUN ON THE WALL
// CLOCK"), for hitstop and slow-motion themselves.
//
// Measures, for a plain tick and for a `wow` tick, the real milliseconds from
// completeTask() to the localStorage value actually changing.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const KEY = 'capy3.journey.v1'
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const src = await (await fetch('/src/shared.js')).text()
    const tb = src.slice(src.indexOf('export const TASKS = ['),
                         src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'[^}]*?chapter:\s*(\d+)([^}]*)\}/g
    const rows = []
    let m
    while ((m = re.exec(tb))) rows.push({ id: m[1], ch: Number(m[2]),
      wow: /wow:\s*'/.test(m[3]) })

    // measure the wall-clock lag from a completeTask to the file changing
    async function lag(id) {
      const before = localStorage.getItem(KEY) || ''
      const t0 = performance.now()
      g.completeTask(id)
      for (let i = 0; i < 400; i++) {
        await sleep(16)
        if ((localStorage.getItem(KEY) || '') !== before) return +(performance.now() - t0).toFixed(0)
      }
      return -1
    }

    const R = {}
    // ---- a plain tick, no slow motion ------------------------------------
    g.biome.switchTo('kyoto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    await sleep(400)
    const plain = rows.filter(r => r.ch === 4 && !r.wow)
    R.plain = await lag(plain[0].id)
    R.plain2 = await lag(plain[1].id)
    // ---- a wow tick, which brings sysWOW_SLOW = 0.55 for 0.75 s ----------
    const wow = rows.find(r => r.ch === 4 && r.wow)
    R.wowId = wow ? wow.id : null
    R.scaleAtWow = null
    if (wow) {
      const before = localStorage.getItem(KEY) || ''
      const t0 = performance.now()
      g.completeTask(wow.id)
      await sleep(120)
      R.scaleAtWow = +g.state.timeScale.toFixed(3)
      let got = -1
      for (let i = 0; i < 400; i++) {
        await sleep(16)
        if ((localStorage.getItem(KEY) || '') !== before) { got = +(performance.now() - t0).toFixed(0); break }
      }
      R.wow = got
    }
    // ---- and with the journal open, which pauses the world ---------------
    const plain3 = rows.filter(r => r.ch === 5 && !r.wow)
    g.biome.switchTo('cali')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    await sleep(400)
    {
      const before = localStorage.getItem(KEY) || ''
      const t0 = performance.now()
      g.completeTask(plain3[0].id)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ', key: 'j', bubbles: true }))
      let got = -1
      for (let i = 0; i < 250; i++) {
        await sleep(16)
        if ((localStorage.getItem(KEY) || '') !== before) { got = +(performance.now() - t0).toFixed(0); break }
      }
      R.paused = got
      R.wasPaused = !!g.state.paused
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
      await sleep(400)
    }
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfsavelag.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
