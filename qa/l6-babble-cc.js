async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  // the three doors back to the blip, and the audit that counts them: a
  // one-word line, a line from 30 m, and every line once "sound as text" is
  // on the settings card
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy, pos = g.capy.position
    const a0 = g.babbleAudit()
    const near = { x: pos.x + 1, y: pos.y, z: pos.z + 1 }, far = { x: pos.x + 30, y: pos.y, z: pos.z }
    g.sfx('babble', { volume: 1, pitch: 1.01, streak: 5, say: { line: 'the ferry comes in at four.' }, force: true, at: near, near: 7, far: 70 })
    await sleep(300)
    g.sfx('babble', { volume: 1, pitch: 1.02, streak: 1, say: { line: 'No.' }, force: true, at: near, near: 7, far: 70 })
    await sleep(300)
    g.sfx('babble', { volume: 1, pitch: 1.03, streak: 5, say: { line: 'the ferry comes in at four.' }, force: true, at: far, near: 7, far: 70 })
    await sleep(300)
    const a1 = g.babbleAudit()
    // the settings card's own switch, through its own change event
    let cc = null
    for (const l of document.querySelectorAll('label')) if (/sound as text/i.test(l.textContent)) { cc = l.querySelector('input'); break }
    if (cc) { cc.checked = true; cc.dispatchEvent(new Event('change', { bubbles: true })) }
    await sleep(100)
    g.sfx('babble', { volume: 1, pitch: 1.04, streak: 5, say: { line: 'the ferry comes in at four.' }, force: true, at: near, near: 7, far: 70 })
    await sleep(300)
    const a2 = g.babbleAudit()
    if (cc) { cc.checked = false; cc.dispatchEvent(new Event('change', { bubbles: true })) }
    await sleep(100)
    g.sfx('babble', { volume: 1, pitch: 1.05, streak: 5, say: { line: 'the ferry comes in at four.' }, force: true, at: near, near: 7, far: 70 })
    await sleep(300)
    const a3 = g.babbleAudit()
    const d = (a, b) => ({ lines: b.lines - a.lines, one: b.blip.one - a.blip.one, far: b.blip.far - a.blip.far, cc: b.blip.cc - a.blip.cc })
    return { ccSwitch: !!cc, steps: { near_one_far: d(a0, a1), captionsOn: d(a1, a2), captionsOff: d(a2, a3) }, speakers: a3.speakers, distinct: a3.distinct, err: g.state.lastError || null }
  })
  out.errs = errs
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-babble-cc.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
