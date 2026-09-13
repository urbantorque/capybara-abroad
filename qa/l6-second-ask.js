async page => {
  // THE SECOND ASK (L6, F2 / design 2.1): the same directed run in Venice,
  // Kowloon and Monaco on two saves — one with every task-taught skill (the
  // nine teachers ticked silently through completeTask(id, true); the two
  // find-taught ones, lungs and soft feet, have no setter and are not needed
  // here) and one with none. The tick set must differ by >= 3 rows; today
  // (before F2) it was identical.
  const TAG = 'l6-second-ask'
  const TEACHERS = ['bin-chicken', 'salsa-dance', 'glacier-run', 'acrobats', 'driftseed', 'bamboo-climb', 'gather', 'the-crossing', 'cross-the-road']
  const ROWS = ['pigeon-passenger', 'traghetto', 'scaffold-kick', 'seed-and-under', 'high-dive']
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = { runs: {} }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const done = async id => page.evaluate(id => window.__capy.taskDone(id), id)
  for (const skilled of [false, true]) {
    await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(6000)
    const R = { started: await page.evaluate(() => window.__capy.state.started), ticks: [], notes: [] }
    if (skilled) await page.evaluate(T => { for (const t of T) window.__capy.completeTask(t, true) }, TEACHERS)
    await page.waitForTimeout(1500)
    R.can = await page.evaluate(() => { const c = window.__capy.capy; return ['herd', 'vault', 'seed', 'mantle', 'flow'].map(k => k + ':' + c.can(k)).join(' ') })
    // ---- Venice: a pigeon on the back, then the traghetto ------------------
    await page.evaluate(() => window.__capy.hud.cross('venice')); await page.waitForTimeout(9000)
    await put(-4, 0.9, -35)                       // the middle of the piazza
    await page.waitForTimeout(800)
    await tap('KeyQ', 120); await page.waitForTimeout(1200); await tap('KeyQ', 120)
    await page.waitForTimeout(9000)               // stand: the loaf, and the climb
    R.notes.push(['venice', 'herd ' + await page.evaluate(() => window.__capy.herdCount()) + ' perch ' + await page.evaluate(() => window.__capy.perchCount())])
    // wait for the boat to be alongside (it holds seven seconds at a pontoon)
    let boat = null
    for (let k = 0; k < 40; k++) {
      if (k % 12 === 6) await tap('KeyQ', 100)
      const s = await page.evaluate(() => { const t = window.__capy.venice.traghetto(); return [t.x, t.y, t.z] })
      await page.waitForTimeout(500)
      const s2 = await page.evaluate(() => { const t = window.__capy.venice.traghetto(); return [t.x, t.y, t.z] })
      if (Math.abs(s[0] - s2[0]) + Math.abs(s[2] - s2[2]) < 0.02) { boat = s2; break }
    }
    if (boat) {
      // board her UNDER WAY (a deck at rest reads as ground and slides out
      // from under the animal — the zero-velocity carrier), and re-centre
      // against the roll's lean every 100 ms: a player steers against it,
      // the harness has no stick. See qa/l6-f2-trag.js.
      // ...and "keep wheeking, or they wander off": the hold is 21 s a wheek
      // (measured: the pigeon got down for 'hold' at 44 s, mid-canal), so one
      // every six seconds through the wait and the crossing
      for (let k = 0; k < 60; k++) {
        await page.waitForTimeout(250)
        if (k % 24 === 0) await tap('KeyQ', 100)
        const s = await page.evaluate(() => { const t = window.__capy.venice.traghetto(); return [t.x, t.y, t.z] })
        if (Math.hypot(s[0] - boat[0], s[2] - boat[2]) > 2.5) { boat = s; break }
      }
      await put(boat[0], boat[1] + 0.7, boat[2])
      await page.waitForTimeout(300)
      R.notes.push(['venice', 'aboard at ' + boat.map(v => +v.toFixed(1)).join(',') + ' perch ' + await page.evaluate(() => window.__capy.perchCount())])
      let minPerch = 9
      for (let k = 0; k < 160; k++) {
        await page.waitForTimeout(100)
        if (k % 60 === 30) await tap('KeyQ', 100)
        const pc = await page.evaluate(() => { const g = window.__capy; const t = g.venice.traghetto(); const b = g.capy.body; const d = Math.hypot(b.position.x - t.x, b.position.z - t.z); if (d > 0.5) { b.position.set(t.x, t.y + 0.7, t.z); b.velocity.set(0, 0, 0) } return g.perchCount() })
        if (pc < minPerch) minPerch = pc
        if (await done('traghetto')) break
      }
      R.notes.push(['venice', 'after crossing perch ' + await page.evaluate(() => window.__capy.perchCount()) + ' (min ' + minPerch + ') traghetto ' + await done('traghetto')])
    } else R.notes.push(['venice', 'boat never stood still'])
    // ---- Kowloon: a hop at the bamboo, and a hop again in the air ----------
    await page.evaluate(() => window.__capy.hud.cross('kowloon')); await page.waitForTimeout(9000)
    const foot = await page.evaluate(() => { const k = window.__capy.kowloon; return [k.scaffoldFoot.x, k.scaffoldFoot.z] })
    await put(foot[0] - 0.5, 0.6, foot[1]); await page.waitForTimeout(1000)
    const v0 = await page.evaluate(() => window.__capy.capy.vaultN)
    for (let k = 0; k < 4; k++) {
      await tap('Space', 90); await page.waitForTimeout(260); await tap('Space', 90); await page.waitForTimeout(1400)
    }
    R.notes.push(['kowloon', 'vaultN ' + v0 + ' -> ' + await page.evaluate(() => window.__capy.capy.vaultN)])
    // ---- Monaco: off the sun deck on the hop key, then under ---------------
    await page.evaluate(() => window.__capy.hud.cross('monaco')); await page.waitForTimeout(9000)
    const s0 = await page.evaluate(() => window.__capy.capy.seedT)
    await put(10, 9.4, -63); await page.waitForTimeout(1200)   // on the sun deck first: the dive arms off the deck
    R.notes.push(['monaco', 'deck y ' + await page.evaluate(() => +window.__capy.capy.position.y.toFixed(2)) + ' grounded ' + await page.evaluate(() => window.__capy.capy.grounded)])
    await put(10 + 4.3 + 1.2, 9.4, -63)          // a step outboard of the sun deck, in the air
    await page.waitForTimeout(120)
    await page.keyboard.down('Space'); await page.waitForTimeout(4500); await page.keyboard.up('Space')
    R.notes.push(['monaco', 'seedT +' + (+(await page.evaluate(() => window.__capy.capy.seedT) - s0).toFixed(2)) + ' swimming ' + await page.evaluate(() => window.__capy.capy.swimming)])
    await page.keyboard.down('KeyE'); await page.waitForTimeout(3500); await page.keyboard.up('KeyE')
    R.notes.push(['monaco', 'depth ' + await page.evaluate(() => +(window.__capy.capy.depth || 0).toFixed(2))])
    await page.waitForTimeout(800)
    for (const id of ROWS) if (await done(id)) R.ticks.push(id)
    R.err = await page.evaluate(() => window.__capy.state.lastError || null)
    out.runs[skilled ? 'skilled' : 'none'] = R
  }
  const a = new Set(out.runs.none.ticks), b = new Set(out.runs.skilled.ticks)
  out.differ = [...new Set([...a, ...b])].filter(id => a.has(id) !== b.has(id))
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
