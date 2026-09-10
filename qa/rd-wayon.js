async page => {
  // rd-wayon.js — the claim made in L4's commit message and not fully measured
  // there: at ENOUGH the way-on row appears, and while anything is still open
  // it does NOT take the pointer. The arrow, the beacon and the metres have to
  // stay on whatever the player was doing.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = { steps: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  await page.evaluate(() => { window.__capy.hud.cross('pasto') })
  await page.waitForTimeout(8000)

  const read = () => page.evaluate(() => {
    const g = window.__capy
    const gi = g.gateInfo(2)
    // the way row is the one with no checkbox that reads 'the way on:'
    const rows = Array.from(document.querySelectorAll('.capyui-todo li'))
    let way = null, pointed = null
    for (const li of rows) {
      const r = li.getBoundingClientRect()
      const shown = r.width > 0 && r.height > 0
      const txt = (li.textContent || '').trim()
      if (txt.indexOf('the way on') === 0) way = { shown: shown, txt: txt }
      // the row carrying the distance readout is the one the card points at
      const aim = li.querySelector('.capyui-aim')
      if (aim && shown && getComputedStyle(aim).opacity !== '0') {
        pointed = { txt: txt.slice(0, 46), aim: (aim.textContent || '').trim() }
      }
    }
    return { done: gi.done, rows: gi.rows, enough: gi.enough, complete: gi.complete,
             way: way, pointed: pointed }
  })

  const g2 = await page.evaluate(() => window.__capy.gateInfo(2))
  const order = [g2.wow].concat(g2.ids.filter(i => i !== g2.wow))
  for (let i = 0; i < order.length; i++) {
    await page.evaluate((id) => { window.__capy.completeTask(id) }, order[i])
    await page.waitForTimeout(500)
    const s = await read()
    out.steps.push(Object.assign({ i: i + 1, id: order[i] }, s))
    if (s.enough && !s.complete && !out.shotAt) {
      out.shotAt = i + 1
      await page.waitForTimeout(1200)
      await shot('wayon-at-threshold')
    }
  }
  await page.waitForTimeout(1500)
  await shot('wayon-at-complete')
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-wayon.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
