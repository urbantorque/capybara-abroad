async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(4000)
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const seen = []
    const kick = document.querySelector('.capyui-moment-kick') ||
                 document.querySelector('[class*=moment] [class*=kick]')
    const mo = new MutationObserver(() => {
      const el = document.querySelector('[class*=moment]')
      if (el && el.className.indexOf('show') >= 0) seen.push(el.textContent.slice(0, 90))
    })
    mo.observe(document.getElementById('hud'), { subtree: true, childList: true,
                                                 attributes: true, characterData: true })
    // stand in the middle of the Botanic Gardens crowd
    let cx = 0, cz = 0, n = 0
    for (const q of (g.npcs || [])) {
      const p = q && q.group ? q.group.position : null
      if (!p) continue
      cx += p.x; cz += p.z; n++
    }
    cx /= n || 1; cz /= n || 1
    const cb = g.capy.body
    cb.position.set(cx, 2, cz); cb.velocity.set(0, 0, 0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(2500)
    const props = (g.props || []).filter(p => p && p.body && !p.removed && !p.held &&
                                              p.body.type === window.__capy.CANNON.Body.DYNAMIC)
    const near = props.slice(0, 6)
    const fired = []
    for (let i = 0; i < 5 && i < near.length; i++) {
      const p = near[i]
      p.body.wakeUp()
      p.body.position.set(cx + (i - 2) * 1.4, 4.5, cz + 1.2)
      p.body.velocity.set(0, 5.5, 0)
      p.disturbed = true
      p.lastCapyTouch = g.state.time
      fired.push(p.type)
      await sleep(1900)
    }
    await sleep(2500)
    mo.disconnect()
    return { crowd: n, at: { x: Math.round(cx), z: Math.round(cz) }, fired,
             cards: seen.slice(-6), kickHad: !!kick }
  })
  await page.evaluate(o => fetch('/shot?name=v51inc.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
