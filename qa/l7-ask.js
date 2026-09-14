async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  const ev = async (f, a) => page.evaluate(f, a)
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const trav = () => ev(() => { const g = window.__capy; const r = g.locals.find(r => r.trav && r.biome === 'goreme'); if (!r) return null; const p = r.group.position; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), carried: !!r.carried, last: r.last, met: g.travMet('goreme') } })
  const out = { started: await ev(() => window.__capy.state.started), bubbles: [] }
  const bub = async (tag) => { const b = await ev(() => [...document.querySelectorAll('.capynpc-bubble')].map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)); for (const x of b) if (!out.bubbles.find(o => o.x === x)) out.bubbles.push({ tag, x }) }
  await ev(() => window.__capy.hud.cross('goreme')); await page.waitForTimeout(9000)
  out.live = await ev(() => window.__capy.biome.current)
  out.travStart = await trav()
  out.balloon = await ev(() => { const t = window.__capy.goreme.balloon(); return [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)] })
  out.travToBasket = +Math.hypot(out.travStart.x - out.balloon[0], out.travStart.z - out.balloon[2]).toFixed(2)
  // stand in front of them first: the cameo's greeting and the met flag
  await put(out.travStart.x + 1.4, out.travStart.y + 0.6, out.travStart.z + 1.0); await page.waitForTimeout(3500)
  await bub('greet')
  out.travGreeted = await trav()
  await page.screenshot({ path: 'qa/l7-ask-field.png' })
  // then into the basket, and up
  await put(out.balloon[0], out.balloon[1] + 0.8, out.balloon[2]); await page.waitForTimeout(1500)
  out.aboard = await ev(() => ({ aboard: window.__capy.goreme.aboard(), travIn: window.__capy.goreme.travIn(), travUp: window.__capy.goreme.travUp() }))
  out.travBoarded = await trav()
  await bub('board')
  await page.keyboard.down('KeyE')
  out.rows = []
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(500)
    const r = await ev(() => { const g = window.__capy; const t = g.locals.find(r => r.trav && r.biome === 'goreme'); const b = g.goreme.balloon(); return { alt: +g.goreme.altitude().toFixed(1), aboard: g.goreme.aboard(), travIn: g.goreme.travIn(), dTrav: +Math.hypot(t.group.position.x - b.x, t.group.position.z - b.z).toFixed(2), dy: +(t.group.position.y - b.y).toFixed(2), err: g.state.lastError ? String(g.state.lastError) : null } })
    out.rows.push(r)
    if (r.alt > 45) break
  }
  await bub('up')
  await page.screenshot({ path: 'qa/l7-ask-up.png' })
  await page.keyboard.up('KeyE')
  out.travUpAt = await ev(() => ({ travUp: window.__capy.goreme.travUp(), travIn: window.__capy.goreme.travIn(), alt: +window.__capy.goreme.altitude().toFixed(1) }))
  // the notebook page, written now: the travUp line and not the square one
  out.pageUp = await ev(() => { const g = window.__capy; g.nbWriteNow && g.nbWriteNow(13); return null })
  // come down: let go and wait for the ground
  for (let k = 0; k < 90; k++) { await page.waitForTimeout(1000); const a = await ev(() => window.__capy.goreme.altitude()); if (a < 1.4) break }
  out.down = await ev(() => ({ alt: +window.__capy.goreme.altitude().toFixed(1), aboard: window.__capy.goreme.aboard(), travIn: window.__capy.goreme.travIn() }))
  // hop out
  await page.keyboard.down('KeyW'); await page.keyboard.press('Space'); await page.waitForTimeout(400); await page.keyboard.press('Space'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW')
  await page.waitForTimeout(1500)
  out.after = await ev(() => ({ alt: +window.__capy.goreme.altitude().toFixed(1), aboard: window.__capy.goreme.aboard(), travIn: window.__capy.goreme.travIn(), travUp: window.__capy.goreme.travUp(), err: window.__capy.state.lastError ? String(window.__capy.state.lastError) : null }))
  out.travAfter = await trav()
  await bub('out')
  await page.screenshot({ path: 'qa/l7-ask-out.png' })
  // the page, as the journey writes it: travel to Sydney writes Cappadocia's page
  await ev(() => window.__capy.hud.travel(1)); await page.waitForTimeout(12000)
  out.nb = await ev(() => { const n = window.__capy.notebook(); return { live: window.__capy.biome.current, page13: n.entries[13] ? n.entries[13].t : null, f13: n.entries[13] ? n.entries[13].f : null } })
  await page.evaluate(o => fetch('/shot?name=l7-ask.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
