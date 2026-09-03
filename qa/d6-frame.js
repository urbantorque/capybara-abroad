async page => {
  // D6: IS THE FRAME THE SAME PRODUCT AS THE GAME INSIDE IT?
  //
  // Six questions, all off the LIVE HUD rather than off the source, because
  // every one of them is about what a player gets and four of them are about
  // whether a rule reaches the DOM at all.
  //
  //   ENTRANCE. The journal and the pause card were the two most-opened cards
  //   in the game and the only two with no entrance: the veil behind them
  //   faded and the paper was already there. Measured as the computed
  //   transform of the card with the parent closed and then open — if the two
  //   are the same string, nothing is dealt.
  //
  //   THE PEN. 231 tasks, and the mark that says one is done was a Unicode
  //   tick scaled from zero with a <div> bar growing through the words.
  //   Measured as the stroke-dashoffset on the two paths before and after the
  //   row is ticked: 1 -> 0 is a pen; anything else is a shape appearing.
  //
  //   THE DIALECT. How many Unicode characters are still being used as
  //   pictures anywhere in the HUD's text, and how many glyphs are drawn.
  //
  //   THE FAN. Six words in circles, or six marks with six labels.
  //
  //   THE PILL. Three kinds, a stack of three, and nothing over the ledger.
  //
  //   THE SOUND. Four UI voices, and silence when calm is on.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 720 })
  const out = { errs: [] }

  async function fresh() {
    // A WAIT BETWEEN THE GOTO AND THE EVALUATE, and it is not politeness. The
    // page is a module graph twenty-seven files deep and page.goto resolves on
    // the document, not on the graph; an evaluate landing in that window dies
    // with "Execution context was destroyed" and takes the whole run with it.
    // Two seconds is longer than the boot has ever taken on this machine.
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
  }

  // ---- 0. the boot card, before anything has started ---------------------
  //
  // PHOTOGRAPHED FIRST AND READ LAST, and the order is not a style. The first
  // build of this file called page.evaluate 120 ms after the goto and the run
  // died with "Execution context was destroyed" — the module graph is still
  // arriving at that point and anything that navigates inside it takes the
  // context with it. A screenshot is taken from OUTSIDE the page and cannot be
  // destroyed by one; and the card is still in the DOM once the game has
  // started (it fades, it is never removed), so every number about it can be
  // read later in peace.
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/d6-boot.png' })

  await fresh()

  // ---- 0b. the masthead, WHILE THE TITLE CARD IS STILL UP ---------------
  // It has to be read here and the first run of this file read it later: the
  // title card is torn out of the DOM when the game starts, so a probe that
  // measures after pressing a chapter key finds no masthead and reports a
  // wordmark that is not there against one that is.
  out.mast = await page.evaluate(() => {
    const svg = document.querySelector('.capyui-mast svg')
    const h1 = document.querySelector('.capyui-mast')
    if (!svg) return { there: false }
    const cs = getComputedStyle(svg)
    return { there: true, shapes: svg.children.length,
             viewBox: svg.getAttribute('viewBox'),
             // no stroke anywhere: it is cut, not drawn
             stroked: svg.querySelectorAll('[stroke]').length,
             px: Math.round(parseFloat(cs.width)) + 'x' + Math.round(parseFloat(cs.height)),
             heading: h1 ? h1.textContent.trim() : '',
             tag: h1 ? h1.tagName : '' }
  })
  // The title card's own sweep, run while it is still in the document — the
  // last four Unicode pictures in this HUD were the arrow KEYCAPS in its
  // footer, and the sweep further down runs after the card has been torn out.
  out.titleDialect = await page.evaluate(() => {
    const PICT = /[←-⇿⌀-⏿■-◿✓✔]/g
    const root = document.querySelector('.capyui-title')
    if (!root) return { there: false }
    let uni = []
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const m = n.nodeValue.match(PICT)
      if (m) uni = uni.concat(m)
    }
    return { there: true, unicodeAsPicture: uni.length, chars: [...new Set(uni)].join(' '),
             glyphs: root.querySelectorAll('.capyui-g').length,
             caps: root.querySelectorAll('kbd').length }
  })
  await page.screenshot({ path: 'qa/d6-mast.png' })

  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  // ...and the boot card's own numbers, read now that the page is quiet.
  out.boot = await page.evaluate(() => {
    const b = document.getElementById('boot')
    if (!b) return { there: false }
    const sheet = b.querySelector('.sheet')
    const orn = b.querySelector('.orn svg')
    const cs = sheet ? getComputedStyle(sheet) : null
    return { there: true, sheet: !!sheet, ornShapes: orn ? orn.children.length : 0,
             spinner: !!b.querySelector('.spin'),
             paper: cs ? cs.backgroundColor : '', radius: cs ? cs.borderRadius : '',
             shadows: cs ? (cs.boxShadow.match(/rgba?\(/g) || []).length : 0,
             secondSheet: sheet ? getComputedStyle(sheet, '::before').content : '' }
  })

  // ---- 1. the dialect ----------------------------------------------------
  out.dialect = await page.evaluate(() => {
    const root = document.getElementById('hud')
    // Every text node in the HUD, plus the ::before/::after content of every
    // element in it — the old triangles lived in CSS `content`, which no DOM
    // walk would have found.
    const PICT = /[←-⇿⌀-⏿■-◿✓✔⬀-⯿]/g
    let uni = []
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const m = n.nodeValue.match(PICT)
      if (m) uni = uni.concat(m)
    }
    const all = root.querySelectorAll('*')
    for (let i = 0; i < all.length; i++) {
      for (const p of ['::before', '::after']) {
        const c = getComputedStyle(all[i], p).content
        if (!c || c === 'none' || c === 'normal') continue
        const m = c.match(PICT)
        if (m) uni = uni.concat(m)
      }
    }
    return { unicodeAsPicture: uni.length, chars: [...new Set(uni)].join(' '),
             glyphs: root.querySelectorAll('.capyui-g').length,
             // EXCLUDING THE PEN, which is stroked on purpose — see
             // sysPenPath. What is being counted here is somebody else's
             // icon set: the pause card's Material speaker was four
             // 1.9px paths and was the only one.
             strokedIcons: [...root.querySelectorAll('svg path[stroke-width]')]
               .filter(function (p) { return !p.closest('.capyui-box,.capyui-strike') }).length,
             pens: root.querySelectorAll('.capyui-strike path').length }
  })

  // ---- 2. the touch fan --------------------------------------------------
  out.fan = await page.evaluate(() => {
    const btns = document.querySelectorAll('.capyui-touch .capyui-btn')
    const rows = []
    for (let i = 0; i < btns.length; i++) {
      rows.push({ cls: btns[i].className.replace('capyui-btn ', ''),
                  words: btns[i].textContent.trim().length,
                  glyph: !!btns[i].querySelector('.capyui-g svg'),
                  label: btns[i].getAttribute('aria-label') || '',
                  role: btns[i].getAttribute('role') || '' })
    }
    return rows
  })

  // ---- 3. the two cards that never arrived -------------------------------
  out.entrance = await page.evaluate(async () => {
    const rows = []
    // A TRANSITION IS NOT DONE ON THE FRAME IT STARTS. getComputedStyle
    // returns the RESOLVED value, which on the frame the class lands is
    // still the old one — the first run of this file toggled and read in
    // the same turn and reported `dealt:false` on three cards that are all
    // dealt. Waited out, at .5s + slack.
    async function look(parentSel, cardSel, open) {
      const p = document.querySelector(parentSel)
      const c = document.querySelector(cardSel)
      if (!p || !c) return null
      p.classList.toggle('show', open)
      await new Promise(r => setTimeout(r, 750))
      const cs = getComputedStyle(c)
      return { transform: cs.transform, opacity: cs.opacity, transition: cs.transitionProperty }
    }
    for (const [pp, cc] of [['.capyui-jr', '.capyui-jrcard'],
                            ['.capyui-pause', '.capyui-pausecard'],
                            ['.capyui-done', '.capyui-done']]) {
      const shut = await look(pp, cc, false)
      const open = await look(pp, cc, true)
      await look(pp, cc, false)
      rows.push({ card: cc, shut: shut && shut.transform, open: open && open.transform,
                  dealt: !!(shut && open && shut.transform !== open.transform),
                  fades: !!(shut && open && shut.opacity !== open.opacity) })
    }
    return rows
  })

  // ---- 4. the pen --------------------------------------------------------
  out.pen = await page.evaluate(async () => {
    const g = window.__capy
    const ids = g.hud.taskIds(1)
    const li = document.querySelector('.capyui-task:not(.capyui-way)')
    const tickPath = li && li.querySelector('.capyui-box svg path')
    const strikePath = li && li.querySelector('.capyui-strike path')
    if (!tickPath || !strikePath) return { there: false }
    // THE STRIKE IS READ OFF ITS CLIP AND NOT OFF ITS DASH, and the first
    // version of this probe read the dash and reported a clean run against
    // a list in which every unticked task was wearing a dotted line. See
    // sysMarkStrike: `getComputedStyle(...).strokeDashoffset` is the
    // DECLARED value and says '1px' whatever the renderer did with it.
    const strikeSvg = li.querySelector('.capyui-strike')
    const before = { tick: getComputedStyle(tickPath).strokeDashoffset,
                     strike: getComputedStyle(strikeSvg).clipPath,
                     len: tickPath.getAttribute('pathLength') }
    g.completeTask(ids[0])
    await new Promise(r => setTimeout(r, 60))
    const during = { tick: getComputedStyle(tickPath).strokeDashoffset,
                     strike: getComputedStyle(strikeSvg).clipPath }
    await new Promise(r => setTimeout(r, 700))
    const after = { tick: getComputedStyle(tickPath).strokeDashoffset,
                    strike: getComputedStyle(strikeSvg).clipPath,
                    // the strike must be the same weight on a long row as on a
                    // short one — see sysMarkStrike
                    vec: strikePath.getAttribute('vector-effect') }
    // ...AND NOTHING ELSE IN THE LIST IS STRUCK. `forwards` fills the end
    // state, and a selector one character too broad would draw a line
    // through every task in the chapter — which is the sort of thing that
    // looks fine in the screenshot you happen to take.
    let wrongly = 0, lines = 0
    const rows = document.querySelectorAll('.capyui-task')
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i].querySelector('.capyui-strike')
      if (!p) continue
      // fully clipped from the right is a strike that has not been made
      const cp = getComputedStyle(p).clipPath
      if (!rows[i].classList.contains('done') && !/100%/.test(cp)) wrongly++
      const tw = rows[i].querySelector('.capyui-tw')
      if (tw && tw.getBoundingClientRect().height > 22) lines++
    }
    return { there: true, before: before, during: during, after: after,
             struckButNotDone: wrongly, rows: rows.length, wrapped: lines }
  })

  // ---- 5. the pill -------------------------------------------------------
  out.toast = await page.evaluate(async () => {
    const g = window.__capy
    const wrap = document.querySelector('.capyui-toasts')
    function live() {
      let n = 0
      for (let i = 0; i < wrap.children.length; i++) if (!wrap.children[i].dataset.going) n++
      return n
    }
    g.toast('a sentence somebody would say')
    g.toast('A LABEL', 'note')
    await new Promise(r => setTimeout(r, 60))
    const kinds = [...wrap.children].map(function (e) {
      const cs = getComputedStyle(e)
      return { cls: e.className.replace('capyui-toast ', '').replace(' in', ''),
               italic: cs.fontStyle, size: cs.fontSize, tracking: cs.letterSpacing,
               caps: cs.textTransform }
    })
    // six at once: the stack must hold three
    for (let i = 0; i < 6; i++) g.toast('spam ' + i)
    await new Promise(r => setTimeout(r, 80))
    const capped = live()
    // ...and the ledger takes the last word
    g.hud.ledger()
    await new Promise(r => setTimeout(r, 300))
    const overLedger0 = live()
    g.toast('this must not appear')
    g.toast('nor this', 'note')
    await new Promise(r => setTimeout(r, 120))
    const overLedger = live()
    return { kinds: kinds, capped: capped, clearedOnOpen: overLedger0,
             raisedOverLedger: overLedger }
  })

  // ---- 6. the sound ------------------------------------------------------
  await fresh()
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  out.sound = await page.evaluate(async () => {
    const g = window.__capy
    function count() { const a = g.hud.uiSfxAudit(); return a.press + a.open + a.detent + a.focus }
    // a press, through the delegated listener every control in the HUD uses
    // SCOPED TO THE HUD, and the first build was not — a bare `button`
    // selector returns the FIRST button in the document, which is the boot
    // card's `Try again`, whose click handler is location.reload(). The run
    // died on 'Execution context was destroyed' three sections later and it
    // looked like a harness fault. It was the probe pressing reload.
    const hud = document.getElementById('hud')
    const btn = hud.querySelector('.capyui-jrrow.go, .capyui-pausebtn, button')
    const before = count()
    if (btn) btn.click()
    await new Promise(r => setTimeout(r, 30))
    const press = count() - before
    // a card opening
    const b2 = count()
    if (!g.hud.pauseShown()) g.hud.pause()
    await new Promise(r => setTimeout(r, 60))
    const open = count() - b2
    if (g.hud.pauseShown()) g.hud.pause()
    // a fader crossing its marks
    const b3 = count()
    const rng = document.querySelector('.capyui-setrange')
    if (rng) {
      for (let v = 0; v <= 100; v += 5) {
        rng.value = String(v)
        rng.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    const detents = count() - b3
    // ...and none of it under calm
    // ...and none of it under calm. The counter still ticks `muted`, so a
    // gate that is silently doing nothing is not the same reading as one
    // that is working.
    // THE REAL SWITCH, not a back door: the calm checkbox on the pause card
    // is what a player touches, and it is the thing that has to gate this.
    const box = document.querySelector('.capyui-setcalm input')
    const wasCalm = !!(box && box.checked)
    if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })) }
    const b4 = g.hud.uiSfxAudit()
    if (rng) { rng.value = '50'; rng.dispatchEvent(new Event('input', { bubbles: true })) }
    if (btn) btn.click()
    await new Promise(r => setTimeout(r, 40))
    const a5 = g.hud.uiSfxAudit()
    if (box && box.checked !== wasCalm) { box.checked = wasCalm; box.dispatchEvent(new Event('change', { bubbles: true })) }
    return { press: press, open: open, detents: detents,
             underCalm: (a5.press + a5.open + a5.detent + a5.focus) - (b4.press + b4.open + b4.detent + b4.focus),
             calmSuppressed: a5.muted - b4.muted,
             audit: g.hud.uiSfxAudit() }
  })

  // ---- 7. the pictures ---------------------------------------------------
  await fresh()
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  await page.screenshot({ path: 'qa/d6-title.png' })
  await page.evaluate(() => { const g = window.__capy; if (!g.hud.pauseShown()) g.hud.pause() })
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/d6-pause.png' })
  // ...and the settings block open, which is where the three faders, the
  // speaker and the calm switch are — every native control on the card.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.capyui-pausebtn')]
      .filter(function (x) { return /settings/i.test(x.textContent) })[0]
    if (b) b.click()
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'qa/d6-settings.png' })
  await page.evaluate(() => { const g = window.__capy; if (g.hud.pauseShown()) g.hud.pause() })
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyJ')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/d6-journal.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.evaluate(async () => {
    const g = window.__capy
    const ids = g.hud.taskIds(1)
    g.completeTask(ids[0])
    await new Promise(r => setTimeout(r, 150))
  })
  await page.screenshot({ path: 'qa/d6-todo.png' })
  // ...and the same card on a phone, where the rows wrap onto two lines and
  // the strike this batch replaces used to sit in the gap between them.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/d6-todo-phone.png' })
  await page.setViewportSize({ width: 1100, height: 720 })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d6-frame.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
