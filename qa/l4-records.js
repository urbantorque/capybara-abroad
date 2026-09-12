async page => {
  // L4 E4 — EVERY MARQUEE A NUMBER. Fresh save, Begin, then each of the eleven
  // chapters whose wow row got a RECORDS row in this batch: enter through
  // hud.cross (the same route qa/l4-marq.js takes), wait 9 s, and where it is
  // cheap force the marquee's live path — a teleport onto the thing, a key, a
  // debug phase setter the chapter already publishes — for 4 s, then read the
  // live record (hud.recordAudit().live / .val) and the standing bests. Where
  // it is not cheap (the two birds, the helicopter) the chapter is entered and
  // the audit read anyway, so a stray live id shows up. Nothing here invents a
  // coordinate: every number below is a constant or an api from the chapter's
  // own file, named in the comment beside it. qa/l4-records.json
  //
  //   sydney   operaStage rect x -9..9 z 1.05..3.9 (environment.js), env.stageNote()
  //   cali     cali.chivaDebug() for her x/y/z, caliROOF_TOP 3.70 above it
  //   iceland  iceland.spring (-40, -10), iceSOAK_R 7, iceCALL_R 16, KeyQ is the wheek
  //   drift    the wood at (-38, 82.6, -114) — drift.js's fly homes; KeyQ wakes up to 4
  //   venice   the square is x -16..8 z -56..10; venice.phaseDebug(0.52) is high water
  //   palawan  palawan.manta() is the ray's live position; KeyE takes hold under water
  //   goreme   goreme.balloon() is the basket; goreme.setPhase(0.44) is ~13 s before the rim
  //   cave     cave.columnDebug().top is the column's top y; cavCOL is (4, -48)
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)

  // ---- helpers, in the page ------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy
    const Q = window.__L4REC = {}
    // stand the animal somewhere: body, velocities and the interpolation
    // history together, or the controller smears it back (the QA.tp idiom)
    Q.tp = function (x, y, z) {
      const b = g.capy.body
      b.position.set(x, y, z)
      b.velocity.set(0, 0, 0)
      b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position)
      b.interpolatedPosition.copy(b.position)
      if (g.capy.position) g.capy.position.set(x, y, z)
      return [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]
    }
    Q.ground = function (biome, x, z) {
      const api = g[biome]
      return api && typeof api.terrainHeight === 'function' ? api.terrainHeight(x, z) : 0
    }
    Q.audit = function () {
      const h = g.hud || {}
      const a = typeof h.recordAudit === 'function' ? h.recordAudit() : null
      const b = typeof h.recAudit === 'function' ? h.recAudit() : null
      const el = document.querySelector('.capyui-rec')
      return {
        biome: g.biome && g.biome.current,
        live: a ? a.live : null,
        val: a && a.val === a.val ? +a.val.toFixed(2) : null,
        best: a ? a.best : null,
        orphans: a ? a.orphans : null,
        recAudit: b,
        line: el ? el.textContent.replace(/\s+/g, ' ').trim() : null,
        err: g.state && g.state.lastError || null,
      }
    }
  })
  const enter = async biome => {
    await page.evaluate(b => { window.__capy.hud.cross(b) }, biome)
    await page.waitForTimeout(9000)
  }
  const audit = () => page.evaluate(() => window.__L4REC.audit())
  const out = {}

  // ---- 1. sydney: opera-stage — the house ------------------------------------
  await enter('sydney')
  out.sydney = { forced: await page.evaluate(() => {
    const Q = window.__L4REC
    // the podium top: the stage carpet decal is at y 1.224, the test wants y > 0.9
    const at = Q.tp(0, 1.6, 2.5)
    const env = window.__capy.env
    const notes = []
    if (env && typeof env.stageNote === 'function') { notes.push(env.stageNote()) }
    return { at, notes }
  }) }
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const e = window.__capy.env; if (e && e.stageNote) e.stageNote() })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const e = window.__capy.env; if (e && e.stageNote) e.stageNote() })
  await page.waitForTimeout(4000)
  out.sydney.audit = await audit()
  out.sydney.concert = await page.evaluate(() => { const e = window.__capy.env; return e && e.concertAudit ? e.concertAudit() : null })

  // ---- 2. pasto: condor-ride — not forced (a summon and a grab) --------------
  await enter('pasto')
  out.pasto = { forced: null, audit: await audit() }

  // ---- 3. cali: chiva-mirador — onto her roof --------------------------------
  await enter('cali')
  out.cali = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, c = window.__capy.cali
    const d = c && typeof c.chivaDebug === 'function' ? c.chivaDebug() : null
    if (!d) return null
    return { chiva: d, at: Q.tp(d.x, d.y + 3.70 + 0.6, d.z) }
  }) }
  // caliCHIVA_PULL_T is 1.3 s on the roof before she pulls away; four more on the road
  await page.waitForTimeout(5500)
  out.cali.audit = await audit()
  out.cali.chiva = await page.evaluate(() => { const c = window.__capy.cali; return c && c.chivaDebug ? c.chivaDebug() : null })

  // ---- 4. rio: fragata-ride — not forced (a summon and a grab) --------------
  await enter('rio')
  out.rio = { forced: null, audit: await audit() }

  // ---- 5. iceland: aurora — sit, wait for the sky, call, step onto the bank --
  await enter('iceland')
  out.iceland = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, ic = window.__capy.iceland
    const s = (ic && ic.spring) || { x: -40, z: -10 }
    // iceSPRING_Y is -0.30 and the soak test wants y < 1.2 inside iceSOAK_R (7 m)
    return { spring: s, at: Q.tp(s.x, 0.3, s.z) }
  }) }
  // iceSOAK_T 7 s ticks the soak and arms the sky; iceAUR_RISE 0.115/s puts it past 0.9 about 8 s later
  await page.waitForTimeout(17000)
  out.iceland.soakAudit = await audit()
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(1500)
  out.iceland.callAudit = await audit()
  // out of the water and onto the bank, 10 m off — inside iceCALL_R (16) and outside iceSOAK_R (7)
  out.iceland.bank = await page.evaluate(() => {
    const Q = window.__L4REC, ic = window.__capy.iceland
    const s = (ic && ic.spring) || { x: -40, z: -10 }
    const x = s.x + 10, z = s.z
    return Q.tp(x, Q.ground('iceland', x, z) + 1.0, z)
  })
  await page.waitForTimeout(4000)
  out.iceland.audit = await audit()

  // ---- 6. drift: lantern — into the wood, one wheek --------------------------
  await enter('drift')
  out.drift = { forced: await page.evaluate(() => {
    const Q = window.__L4REC
    // the wood: home { x: -38, y: 82.6, z: -114, n: 22 } in drift.js
    const x = -38, z = -114
    return { at: Q.tp(x, Q.ground('drift', x, z) + 1.0, z) }
  }) }
  await page.waitForTimeout(2500)                  // land and settle: the wheek needs capy.grounded
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(4000)
  out.drift.audit = await audit()
  out.drift.lampflies = await page.evaluate(() => { const d = window.__capy.drift; return d && d.lampflies ? d.lampflies() : null })

  // ---- 7. venice: acqua-alta — into the square at high water -----------------
  await enter('venice')
  out.venice = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, v = window.__capy.venice
    const at = Q.tp(-4, 1.0, -34)                // the middle of the piazza
    const ph = v && typeof v.phaseDebug === 'function' ? v.phaseDebug(0.52) : null
    return { at, phase: ph }
  }) }
  await page.waitForTimeout(5000)                  // venWaterY damps up at rate 6; a second is plenty
  out.venice.audit = await audit()

  // ---- 8. kowloon: symphony — not forced (a flight through eight rings) ------
  await enter('kowloon')
  out.kowloon = { forced: null, audit: await audit(),
                  heli: await page.evaluate(() => { const k = window.__capy.kowloon; return k && k.heli ? k.heli() : null }) }

  // ---- 9. palawan: the-manta — beside the ray, under water, E ----------------
  await enter('palawan')
  out.palawan = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, p = window.__capy.palawan
    const m = p && typeof p.manta === 'function' ? p.manta() : null
    if (!m) return null
    // palMANTA_REACH is 3.6 m; the ray cruises at palMANTA_Y (-6), so this is under
    return { manta: [+m.x.toFixed(1), +m.y.toFixed(1), +m.z.toFixed(1)], at: Q.tp(m.x + 1.5, m.y, m.z) }
  }) }
  await page.waitForTimeout(700)                   // capy.depth has to read > 0.65 first
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(4000)
  out.palawan.audit = await audit()

  // ---- 10. goreme: sunrise — into the basket, the dawn wound to 13 s before the rim, burner on
  await enter('goreme')
  out.goreme = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, go = window.__capy.goreme
    const b = go && typeof go.balloon === 'function' ? go.balloon() : null
    if (!b) return null
    const at = Q.tp(b.x, b.y + 0.6, b.z)
    // winAt is gorSUN_P + 0.115 * 0.48 = 0.5252; 0.44 is (0.5252 - 0.44) * 156 = 13.3 s out
    const ph = typeof go.setPhase === 'function' ? go.setPhase(0.44) : null
    return { basket: [+b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1)], at, phase: ph }
  }) }
  await page.keyboard.down('Space')                // the burner: the aboard block wants 2.5 m of air
  await page.waitForTimeout(6000)
  out.goreme.audit = await audit()
  out.goreme.aboard = await page.evaluate(() => { const go = window.__capy.goreme; return go && go.aboard ? go.aboard() : null })
  await page.keyboard.up('Space')

  // ---- 11. cave: the-column — stepped off the top ----------------------------
  await enter('cave')
  out.cave = { forced: await page.evaluate(() => {
    const Q = window.__L4REC, c = window.__capy.cave
    const d = c && typeof c.columnDebug === 'function' ? c.columnDebug() : null
    const col = (c && c.column) || { x: 4, z: -48 }
    if (!d) return null
    // one metre over the top of the column (cavCOL.h is 28 above cavColBase), and let go
    return { column: d, at: Q.tp(col.x, d.top + 1.0, col.z) }
  }) }
  // the fall is held at half speed for 1.8 s: sample through it and keep the first live frame
  out.cave.samples = []
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(600)
    out.cave.samples.push(await audit())
  }
  await page.waitForTimeout(2500)
  out.cave.audit = await audit()
  out.cave.column = await page.evaluate(() => { const c = window.__capy.cave; return c && c.columnDebug ? c.columnDebug() : null })

  // ---- the table ----------------------------------------------------------------
  out.summary = {}
  for (const k of Object.keys(out)) {
    if (!out[k] || !out[k].audit) continue
    out.summary[k] = { live: out[k].audit.live, val: out[k].audit.val, line: out[k].audit.line, err: out[k].audit.err }
  }
  out.best = out.cave.audit.best
  out.orphans = out.cave.audit.orphans
  await page.evaluate((o) => fetch('/shot?name=l4-records.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
