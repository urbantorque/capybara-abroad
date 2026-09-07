async page => {
  // ---------------------------------------------------------------------------
  // qa/second-voice.js — DOES A6's SECOND VOICE EVER PLAY A NOTE?
  //
  // `musAudit().second` reports that the palette HAS a second-voice row, which
  // is a fact about a table. It stayed true for the whole time the voice was
  // throwing `ReferenceError: pan is not defined` before it could schedule
  // anything. `secondN` counts notes actually scheduled, which is the question.
  //
  // The voice only enters above `sysMUS_2ND_AT` = 0.33 of a chapter's tasks, so
  // a probe that opens a fresh chapter and listens measures nothing: this ticks
  // rows through `game.completeTask` until progress is past the threshold.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)          // unlocks the AudioContext
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)

  // ---- HOW MANY NOTES THE SCORE SCHEDULES, EITHER SIDE OF THE THRESHOLD ----
  // The exception fires BEFORE `musPluckAt += …`, so if it is really killing
  // the scheduler the melody stops rather than merely losing its answer. Count
  // oscillators. `create*` lives on `BaseAudioContext.prototype` — patching
  // `AudioContext.prototype` counts zero and reads as "no audio ever played".
  await page.evaluate(() => {
    const P = window.BaseAudioContext && window.BaseAudioContext.prototype
    if (!P || P.__oscHooked) return
    P.__oscHooked = true
    window.__oscN = 0
    const raw = P.createOscillator
    P.createOscillator = function () { window.__oscN++; return raw.apply(this, arguments) }
  })
  const oscBefore = await page.evaluate(() => new Promise((r) => {
    const a = window.__oscN
    setTimeout(() => r(window.__oscN - a), 20000)
  }))

  const before = await page.evaluate(() => {
    const g = window.__capy
    const a = g.musAudit()
    return { pal: a.pal, second: a.second, secondN: a.secondN === undefined ? 'ABSENT' : a.secondN,
             prog: a.chapProg, osc20: window.__oscN, lastError: g.state.lastError || null }
  })

  // Half of Sydney's nineteen rows: comfortably past 0.33.
  await page.evaluate(() => {
    const g = window.__capy
    const ids = ['wheek', 'steal-hat', 'coffee-spill', 'picnic-thief', 'bin-chicken',
                 'dig-flower', 'photo-op', 'swim', 'cafe-table', 'sprinkler']
    for (const id of ids) { try { g.completeTask(id, true) } catch (e) {} }
  })
  await page.waitForTimeout(2000)
  const mid = await page.evaluate(() => {
    const a = window.__capy.musAudit()
    return { prog: a.chapProg, secondN: a.secondN === undefined ? 'ABSENT' : a.secondN }
  })

  // The same twenty-second window, on the far side of the threshold.
  const oscAfter = await page.evaluate(() => new Promise((r) => {
    const a = window.__oscN
    setTimeout(() => r(window.__oscN - a), 20000)
  }))
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))

  const after = await page.evaluate(() => {
    const g = window.__capy
    const a = g.musAudit()
    return { pal: a.pal, second: a.second, secondN: a.secondN === undefined ? 'ABSENT' : a.secondN,
             prog: a.chapProg, bar: a.bar, beatLen: a.beatLen,
             lastError: g.state.lastError || null }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=second-voice.json', { method: 'POST', body: s })
  }, { before: before, mid: mid, after: after,
       oscBefore: oscBefore, oscAfter: oscAfter, errs: errs })
}
