async page => {
  // ---------------------------------------------------------------------------
  // qa/pips.js — IS THE CHAIN LEGIBLE WHILE IT IS OPEN? (ROADMAP-FUN, item 2)
  //
  // The chain is fed by four events, all of which need something the player
  // did AND somebody to have seen it. Rather than trying to drive a random walk
  // into five witnessed collisions, this emits the event npc.js and props.js
  // emit — `prop:destroy` with `disturbed` set — at the animal's own feet,
  // where Sydney's spawn has eight people standing. `incAdd`'s witness gate is
  // NOT bypassed: `findPeople` still has to answer, which is the half of the
  // rule that matters and the half a fake event could quietly skip.
  //
  // Checked: the row is absent at rest, appears on the first counted thing,
  // lights one pip per thing, drains its window bar, and goes again when the
  // window closes.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)

  function snap() {
    return page.evaluate(() => {
      const el = document.querySelector('.capyui-pips')
      const bars = [...document.querySelectorAll('.capyui-pips b')]
      const win = document.querySelector('.capyui-pips s')
      const r = el ? el.getBoundingClientRect() : null
      return {
        on: !!(el && el.classList.contains('on')),
        h: r ? Math.round(r.height) : -1,
        bars: bars.length,
        lit: bars.filter(b => b.classList.contains('lit')).length,
        gate: bars.findIndex(b => b.classList.contains('gate')),
        win: win ? win.style.transform : ''
      }
    })
  }

  const out = { rest: await snap(), steps: [], errs: errs }
  for (let i = 0; i < 5; i++) {
    await page.evaluate((n) => {
      const g = window.__capy
      const p = g.capy.position
      g.events.emit('prop:destroy', {
        prop: { disturbed: true, id: 'probe-' + n,
                body: { position: { x: p.x, y: p.y, z: p.z } } }
      })
    }, i)
    await page.waitForTimeout(1200)
    out.steps.push(await snap())
  }
  // Let the twelve-second window run out.
  await page.evaluate(() => new Promise(r => setTimeout(r, 14000)))
  out.after = await snap()

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=pips.json', { method: 'POST', body: s })
  }, out)
}
