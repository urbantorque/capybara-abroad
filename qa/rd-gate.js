async page => {
  // rd-gate.js — does the door open at ENOUGH, and does nothing else move?
  //
  // The whole risk in L4 is that chapComplete is read in a dozen places and one
  // of them is the finale arithmetic. So this walks chapter 2 up one row at a
  // time, MARQUEE LAST, and after every tick asks both questions: is the next
  // place offered, and has anything that belongs to a finished chapter fired
  // early. Then it does the same with the marquee FIRST, because "the marquee
  // plus seven in ten" has two orders and only one of them was thought about
  // when it was written.
  const out = {}
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  out.before = await page.evaluate(() => window.__capy.gateInfo())

  const run = async (marqueeLast) => {
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    await page.reload()
    await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(2000)
    const g2 = await page.evaluate(() => window.__capy.gateInfo(2))
    const ids = g2.ids.filter(i => i !== g2.wow)
    const order = marqueeLast ? ids.concat([g2.wow]) : [g2.wow].concat(ids)
    const steps = []
    for (let i = 0; i < order.length; i++) {
      await page.evaluate((id) => { window.__capy.completeTask(id) }, order[i])
      await page.waitForTimeout(140)
      const s = await page.evaluate(() => {
        const g = window.__capy
        const a = g.gateInfo(2), b = g.gateInfo(3)
        return { done: a.done, wowDone: a.wowDone, enough: a.enough,
                 complete: a.complete, open3: b.open, kept: g.gateInfo()
                   .filter(x => x.complete).length }
      })
      steps.push(Object.assign({ i: i + 1, id: order[i] }, s))
    }
    return { rows: g2.rows, need: g2.need, wow: g2.wow, steps }
  }

  out.marqueeLast = await run(true)
  out.marqueeFirst = await run(false)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-gate.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
