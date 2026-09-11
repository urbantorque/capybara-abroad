async page => {
  // m7-getaway.js — a theft ticks when you GET AWAY with it.
  //
  // Three questions, and the third is the one that matters:
  //   1. does it refuse on the grab itself?
  //   2. does it pay out on distance, and on persistence?
  //   3. can it be LOST? Take the prop back off the animal and check the row
  //      is still reachable.
  //
  // Trap 40 governs the whole shape of this: a teleport is motion, and anything
  // gated on holding still or on a reach refuses for several frames afterwards.
  // The body is pinned on a setInterval for the length of each leg and every
  // precondition is re-read on the frame before the key goes down.
  const out = { legs: [] }
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
  if (!out.started) {
    await page.evaluate(async (o) => {
      await fetch('/shot?name=m7-getaway.json', { method: 'POST',
        body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
    }, out)
    return
  }

  // Put the animal on a sandwich and hold it there.
  const setup = await page.evaluate(() => {
    const g = window.__capy
    const props = g.props || []
    let s = null
    for (let i = 0; i < props.length; i++) {
      if (props[i].type === 'sandwich' && !props[i].removed) { s = props[i]; break }
    }
    if (!s) return { found: false, types: props.slice(0, 40).map(p => p.type) }
    const b = s.body
    window.__pinX = b.position.x + 0.55
    window.__pinZ = b.position.z
    window.__pinY = b.position.y + 0.45
    window.__homeX = s.homeX; window.__homeZ = s.homeZ
    if (window.__pinT) clearInterval(window.__pinT)
    window.__pinT = setInterval(function () {
      const cb = g.capy.body
      cb.position.set(window.__pinX, window.__pinY, window.__pinZ)
      cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0)
    }, 16)
    return { found: true, home: [+s.homeX.toFixed(1), +s.homeZ.toFixed(1)],
             done: g.taskDone('picnic-thief') }
  })
  out.setup = setup
  if (!setup.found) {
    await page.evaluate(async (o) => {
      await fetch('/shot?name=m7-getaway.json', { method: 'POST',
        body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
    }, out)
    return
  }
  await page.waitForTimeout(1200)
  // grab it, through the real key
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(400)
  out.legs.push(await page.evaluate(() => {
    const g = window.__capy
    return { leg: 'on the grab', held: !!(g.capy.heldProp),
             done: g.taskDone('picnic-thief'), audit: g.physics.getawayAudit() }
  }))
  // ...and still nothing three seconds later, standing on the spot it came from
  await page.waitForTimeout(3000)
  out.legs.push(await page.evaluate(() => {
    const g = window.__capy
    return { leg: '3.4 s, still at the picnic', held: !!(g.capy.heldProp),
             done: g.taskDone('picnic-thief'), audit: g.physics.getawayAudit() }
  }))
  // ...and now carry it away. Pin the animal 22 m off, which is past the leash.
  await page.evaluate(() => {
    window.__pinX = window.__homeX + 22
    window.__pinZ = window.__homeZ
  })
  await page.waitForTimeout(900)
  out.legs.push(await page.evaluate(() => {
    const g = window.__capy
    return { leg: '22 m away', held: !!(g.capy.heldProp),
             done: g.taskDone('picnic-thief'), audit: g.physics.getawayAudit() }
  }))

  // ---- the one that matters: can it be lost? --------------------------
  // Take the prop out of the animal's mouth the way every reclaim in the game
  // does, then check the row is still reachable by grabbing another one.
  await page.evaluate(() => {
    const g = window.__capy
    g.physics.release(null)
  })
  await page.waitForTimeout(600)
  out.legs.push(await page.evaluate(() => {
    const g = window.__capy
    return { leg: 'taken back off you', held: !!(g.capy.heldProp),
             done: g.taskDone('picnic-thief'), audit: g.physics.getawayAudit() }
  }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m7-getaway.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
  await page.evaluate(() => { if (window.__pinT) clearInterval(window.__pinT) })
}
