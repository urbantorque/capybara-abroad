async page => {
  const TAG = 'l7r-design-shove'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => {
    window.__ev = []
    const t0 = performance.now()
    const stamp = () => Math.round((performance.now() - t0) / 100) / 10
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([stamp(), n.textContent.slice(0, 90)]) }).observe(w, { childList: true })
    document.querySelector('.capyui-go').click()
  })
  await page.waitForTimeout(7000)
  const out = { trials: [] }
  const trial = async (name, fn) => {
    const before = await page.evaluate(() => ({ n: window.__ev.length, imp: window.__capy.state.impulseLast || null }))
    // sample speed at 50 Hz during the trial
    await page.evaluate(() => { window.__spd = []; window.__spdI = setInterval(() => { const g = window.__capy; const v = g.capy.body ? g.capy.body.velocity : (g.capy.velocity || { x: 0, y: 0, z: 0 }); window.__spd.push(+Math.hypot(v.x, v.y, v.z).toFixed(2)) }, 20) })
    await fn()
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => { clearInterval(window.__spdI); return { n: window.__ev.length, imp: window.__capy.state.impulseLast || null, ev: window.__ev, spd: window.__spd } })
    out.trials.push({ name, pills: after.ev.slice(before.n).filter(e => /that was/.test(e[1])), imp: after.imp, spdMax: Math.max(...after.spd), spd: after.spd.slice(0, 60) })
    await page.waitForTimeout(4500)   // past the cooldown
  }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  await trial('walk-2s', async () => { await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW') })
  await trial('run-from-still-2s', async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft') })
  await trial('run-from-still-2s-again', async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await page.waitForTimeout(2000); await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft') })
  await trial('hop-standing', async () => { await tap('Space', 90); await page.waitForTimeout(1200) })
  await trial('run-then-hop', async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await tap('Space', 90); await page.waitForTimeout(1200); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft') })
  await trial('run-slide-G', async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await tap('KeyG', 700); await page.waitForTimeout(600); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft') })
  await trial('turn-run-A', async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyA'); await page.waitForTimeout(1500); await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft') })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
