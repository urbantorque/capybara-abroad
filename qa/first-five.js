async page => {
  // ---------------------------------------------------------------------------
  // qa/first-five.js — THE FIRST FIVE MINUTES OF EVERY PLACE (ROADMAP-FUN, 1f)
  //
  // Fifty-odd passes have measured the picture, the sound, the physics and the
  // paper, and not one of them has ever measured the thing this game is
  // actually judged on: what happens in the first minute of a chapter. Nobody
  // has timed one. This times nineteen.
  //
  // Per chapter, entered the way a player enters it:
  //
  //   tFirstTick   s to the first task ticked
  //   tSee         s to the first frame in which the marquee point is inside
  //                the frustum and not behind anything
  //   seePct       fraction of sampled frames it was visible in
  //   gapMax       longest run of seconds with no tick at all
  //   ticks        how many rows fell in the window
  //   marqOn       was the marquee LINE on the paper (1b) at t = 3 s
  //   marqSay      what it said
  //
  // THE DRIVER IS A RANDOM WALK, NOT A PLAYER. It is a floor, not a forecast:
  // a number this produces is what a chapter gives somebody who is wandering,
  // which is what a first-time player is doing. B0's stranger outranks it.
  //
  // Three things it deliberately does NOT do:
  //   - it does not use `switchTo`, which does not move the animal at all
  //     (measured: Hanoi reported Sydney's grass as its spawn);
  //   - it does not trust `o.visible` for occlusion. A detached biome's root
  //     is hidden and every child of it keeps visible === true, so the first
  //     cut of this named `pastoChurch` as the occluder in Palawan,
  //     Cappadocia and Antarctica. It walks the parents;
  //   - it does not clear the save halfway. localStorage is cleared once, in
  //     an init script, before the first reload — a task ticked by an earlier
  //     probe reads back as done for ever and every tick timing in the file
  //     would be a zero.
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  // The one row each chapter is for. `qa/p6-static.cjs` asserts there is
  // exactly one per chapter, so this table cannot silently go stale against
  // shared.js without that test failing first.
  const WOW = {
    sydney: 'opera-stage', pasto: 'condor-ride', quay: 'manly-voyage',
    kyoto: 'uji-run', cali: 'chiva-mirador', rio: 'samba-parade',
    iceland: 'aurora', sahara: 'dune-surf', drift: 'lantern',
    venice: 'acqua-alta', kowloon: 'symphony', palawan: 'the-bloom',
    goreme: 'sunrise', manly: 'all-the-way', pantanal: 'the-crossing',
    cave: 'the-doline', antarctic: 'orca-ride', monaco: 'the-tunnel',
    hanoi: 'the-train'
  }
  // Ninety seconds and not three hundred: this is the window the three numbers
  // in ROADMAP-FUN are stated against (the marquee in frame inside 60 s, the
  // first tick inside 30 s), and nineteen five-minute chapters is an hour and a
  // half of wall clock per run, which is a soak nobody re-runs.
  const SECONDS = 90
  const SAMPLE = 500          // ms between samples

  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  // Digit0 is chapter 10. Anything but the first chapter measured, so the
  // first `hud.cross` below is a real crossing and not a no-op on a live biome.
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const out = { wander: [], verbs: [], errs: errs, seconds: SECONDS }
  for (const VERBS of [false, true]) {
  const rows = VERBS ? out.verbs : out.wander
  // A clean save between the two passes, or the second one arrives with every
  // row the first one ticked already crossed off and reports nineteen chapters
  // of nothing to do. This is trap 8 in the harness notes, and the two-pass
  // shape is exactly the case it was written for.
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    // 1.28 s of white and then the 3.60 s arrival shot. The clock starts when
    // the white clears, because that is when the player can do anything.
    await page.waitForTimeout(1400)
    await page.evaluate((arg) => {
      const g = window.__capy
      const THREE = g.THREE
      const S = { t0: performance.now(), tick0: -1, see0: -1, seeN: 0, n: 0,
                  ticks0: g.hud.tasksDone(), lastTick: 0, gapMax: 0, wowAt: -1,
                  ticksAt0: g.hud.tasksDone(),
                  marqOn: null, marqSay: '', point: null, dist0: -1, occl: '' }
      window.__ff = S
      window.__ffWow = arg.wow
      function drawn(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
      window.__ffT = setInterval(function () {
        const now = (performance.now() - S.t0) / 1000
        S.n++
        // ---- the paper, once the card is up ------------------------------
        if (S.marqOn === null && now > 2.5) {
          const el = document.querySelector('.capyui-marq')
          S.marqOn = !!(el && el.classList.contains('on'))
          const t = document.querySelector('.capyui-marqtxt')
          const s = document.querySelector('.capyui-marqsay')
          S.marqSay = ((t && t.textContent) || '') + ' / ' + ((s && s.textContent) || '')
        }
        // ---- ticks -------------------------------------------------------
        const done = g.hud.tasksDone()
        if (done > S.ticks0) {
          if (S.tick0 < 0) S.tick0 = now
          S.ticks0 = done
          S.lastTick = now
        }
        const gap = now - S.lastTick
        if (gap > S.gapMax) S.gapMax = gap
        // ---- ...and the marquee itself, if a random walk ever lands one ----
        if (S.wowAt < 0 && window.__ffWow && g.hud.isTaskDone(window.__ffWow)) S.wowAt = now
        // ---- the marquee, in frame and unoccluded -------------------------
        const m = g.marqueePoint ? g.marqueePoint() : null
        if (!m) return
        if (!S.point) S.point = { x: +m.x.toFixed(1), y: +m.y.toFixed(1), z: +m.z.toFixed(1), live: !!m.live }
        const c = g.capy.position
        if (S.dist0 < 0) S.dist0 = +Math.hypot(m.x - c.x, m.z - c.z).toFixed(1)
        const p = new THREE.Vector3(m.x, m.y, m.z)
        const ndc = p.clone().project(g.camera)
        if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z <= -1 || ndc.z >= 1) return
        const cam = g.camera.position
        const dir = p.clone().sub(cam)
        const len = dir.length()
        if (len < 2) return
        dir.normalize()
        const rc = new THREE.Raycaster(cam.clone(), dir, 0.6, len - 1.5)
        let blocked = ''
        try {
          const hits = rc.intersectObjects(g.scene.children, true)
          for (let i = 0; i < hits.length; i++) {
            const o = hits[i].object
            if (!o.isMesh || !o.material || !drawn(o)) continue
            const mt = o.material
            if (mt.transparent && mt.opacity < 0.5) continue
            const bs = o.geometry && o.geometry.boundingSphere
            if (bs && bs.radius > 400) continue      // sky dome, haze shell
            blocked = o.name || o.type
            break
          }
        } catch (e) { blocked = 'THREW' }
        if (blocked) { if (!S.occl) S.occl = blocked; return }
        S.seeN++
        if (S.see0 < 0) S.see0 = now
      }, arg.ms)
    }, { ms: SAMPLE, wow: WOW[b] })

    // ---- THE DRIVER, AND WHY IT HAS TWO SETTINGS (B6) --------------------
    //
    // B1's driver held WASD and pressed Space and Q. It never pressed E, and
    // B4 measured what that costs: of the six chapters where ninety seconds
    // "ticks nothing", three — Iceland, Marrakech, Hong Kong — have their first
    // row inside 12 m, and every one of those rows is a THEFT. The instrument
    // was reporting a fact about itself.
    //
    // `VERBS` adds the two inputs a real player has and this did not: E, which
    // is grab and throw and six other things by context, and Shift, which is
    // the difference between walking past a bin and barging it (`physBarge`
    // needs 3.2 m/s). Both settings are run so the two columns can be compared
    // in one session — a driver change makes a table incomparable with the one
    // before it, and B1's numbers are the ones this batch exists to move.
    const KEYS = ['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyD', 'KeyS']
    const t1 = Date.now() + SECONDS * 1000
    let k = 'KeyW'
    if (VERBS) await page.keyboard.down('ShiftLeft')
    while (Date.now() < t1) {
      await page.keyboard.up(k).catch(() => {})
      k = KEYS[(Math.random() * KEYS.length) | 0]
      await page.keyboard.down(k)
      if (Math.random() < 0.25) await page.keyboard.press('Space')
      if (Math.random() < 0.2) await page.keyboard.press('KeyQ')
      // E twice a leg: once mid-stride, which is a grab at whatever is in
      // reach, and once at the end, which throws whatever the first one got.
      if (VERBS) {
        await page.keyboard.press('KeyE')
        await page.waitForTimeout(750)
        await page.keyboard.press('KeyE')
        await page.waitForTimeout(750)
      } else {
        await page.waitForTimeout(1500)
      }
    }
    await page.keyboard.up(k).catch(() => {})
    if (VERBS) await page.keyboard.up('ShiftLeft').catch(() => {})

    const r = await page.evaluate((arg) => {
      const g = window.__capy
      clearInterval(window.__ffT)
      const S = window.__ff
      // The signpost AT THE END as well as at the start, and the reason it is
      // off if it is. Without this pair the same screenshot supports two
      // opposite readings — the line broke, or the marquee was ticked and the
      // line correctly stood down — and the first run of this file spent a
      // quarter of an hour on exactly that ambiguity.
      const el = document.querySelector('.capyui-marq')
      return {
        biome: g.biome.current, want: arg.b,
        marqEnd: !!(el && el.classList.contains('on')),
        marqEndH: el ? +el.getBoundingClientRect().height.toFixed(1) : -1,
        wowAt: S.wowAt < 0 ? null : +S.wowAt.toFixed(1),
        tFirstTick: S.tick0 < 0 ? null : +S.tick0.toFixed(1),
        tSee: S.see0 < 0 ? null : +S.see0.toFixed(1),
        seePct: S.n ? +(S.seeN / S.n).toFixed(3) : 0,
        gapMax: +S.gapMax.toFixed(1),
        // Rows ticked IN THIS CHAPTER. tasksDone() is the running total for
        // the session and reads as a chapter having done well simply for
        // coming late in the list.
        ticks: g.hud.tasksDone() - S.ticksAt0,
        marqOn: S.marqOn, marqSay: S.marqSay,
        point: S.point, dist0: S.dist0, occl: S.occl,
        err: g.state.lastError || null
      }
    }, { b: b })
    rows.push(r)
    await page.screenshot({ path: 'qa/FF-' + (VERBS ? 'v-' : '') + b + '.png' })
  }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=first-five.json', { method: 'POST', body: s })
  }, out)
}
