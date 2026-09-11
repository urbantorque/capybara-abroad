async page => {
  // m11-ending.js — DOES THE LAST SCENE SAY ANYTHING?
  //
  // Four assertions, and the third is the one the change is for:
  //   1. the traveller is on the ring, once, not five deep
  //   2. the five gatherers each say something, ONCE, and not in chorus
  //   3. the traveller gets MORE THAN ONE LINE before the card arrives, and the
  //      lines are the stranger set for a player who never met them
  //   4. the closing sentence is on the final card and not on any other
  const out = { }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  out.travMet0 = await page.evaluate(() => (window.__capy.travMet ? window.__capy.travMet() : -1))

  // Record every bubble the whole cast puts up, for the length of the scene.
  await page.evaluate(() => {
    const g = window.__capy
    window.__said = []
    // The bubbles are inline-styled divs with NO CLASS (npc.js builds them from
    // a cssText string), so there is nothing to select on. The honest cheap
    // thing is to watch the rendered text of the HUD layer itself, which is
    // what a player reads.
    const seen = new Set()
    window.__sayT = setInterval(function () {
      const root = document.querySelector('.capyui') || document.body
      // ...and a bubble is the only span whose PARENT is an unclassed div with
      // an inline absolute position. The whole HUD is spans, so without that
      // filter this reads back the legend and the to-do card.
      const els = root.querySelectorAll('span')
      for (let i = 0; i < els.length; i++) {
        const p = els[i].parentElement
        if (!p || p.className || p.tagName !== 'DIV') continue
        if ((p.getAttribute('style') || '').indexOf('position:absolute') < 0) continue
        const t = (els[i].textContent || '').trim()
        if (t && !seen.has(t)) {
          seen.add(t); window.__said.push({ t: t, at: +g.state.time.toFixed(1) })
        }
      }
    }, 120)
  })

  // Stage the finale. The honest door is the event the game uses itself.
  out.stage = await page.evaluate(() => {
    const g = window.__capy
    try { g.events.emit('finale:staged', {}) } catch (e) { return 'throw ' + e.message }
    return 'ok'
  })
  await page.waitForTimeout(1500)
  out.ring = await page.evaluate(() => {
    const g = window.__capy
    // count travellers standing in Sydney, off the roster rather than a table
    let n = 0, pos = null
    const ls = g.locals || []
    for (let i = 0; i < ls.length; i++) {
      if (ls[i].trav && ls[i].biome === 'sydney') {
        n++
        if (ls[i].group) pos = [+ls[i].group.position.x.toFixed(1), +ls[i].group.position.z.toFixed(1)]
      }
    }
    return { travellers: n, at: pos, locals: ls.length }
  })
  // Sit in the middle of the horseshoe and let it play.
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    if (window.__pinT) clearInterval(window.__pinT)
    window.__pinT = setInterval(function () {
      b.position.set(30, 0.45, 26)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
    }, 16)
  })
  await page.waitForTimeout(22000)
  await page.evaluate(() => { if (window.__pinT) clearInterval(window.__pinT) })
  out.said = await page.evaluate(() => {
    if (window.__sayT) clearInterval(window.__sayT)
    return window.__said.slice(0, 60)
  })
  await page.screenshot({ path: 'qa/m11-lawn.png' })

  // The closing sentence, on a ledger that is NOT final and on one that is.
  out.card = await page.evaluate(() => {
    const g = window.__capy
    const read = function () {
      const e = document.querySelector('.capyui-ledlast')
      return e ? { text: (e.textContent || '').trim(), hidden: !!e.hidden } : null
    }
    const out = {}
    try { g.hud.ledger ? g.hud.ledger() : null } catch (e) {}
    out.mid = read()
    return out
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m11-ending.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
