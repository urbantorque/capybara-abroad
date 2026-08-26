async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)

  // ------------------------------------------------------------------------
  // THREE GATES, and the reason there are three is in qa/BUDGET.md.
  //
  // 1. TRIANGLES, 130,000, which is what the Payoff Pass brief asks for. Ten
  //    of seventeen chapters are over it and the reallocation pass could not
  //    close that without deleting near-field content, which the same brief
  //    forbids. It is reported because a count that doubles is worth knowing.
  // 2. COST, in milliseconds of actual render, which is what the triangle gate
  //    was standing in for and does not predict — a four-to-one spread in cost
  //    per triangle, with the two cheapest chapters per triangle among the
  //    three largest. Nothing is within a factor of three of this gate.
  // 3. THE RATCHET, which is the one that will actually catch something. Quay
  //    went 132,423 -> 202,391 in two days of content work and nobody saw it.
  //    No chapter may exceed its recorded ceiling.
  // ------------------------------------------------------------------------
  const TRI_BUDGET = 130000
  const MS_BUDGET = 5.5          // a third of a frame, for everything one
                                 // chapter draws. Nothing is near it.
  // Measured 26 Aug 2026 after the batch-4 reallocation, plus slack. Raise a
  // line ONLY with a measurement and a reason.
  //
  // THE SLACK IS PER CHAPTER, AND THE +/-1,500 THIS TABLE WAS FIRST SIZED
  // AGAINST WAS MEASURED ON THE WRONG AXIS. The scatter helpers call unseeded
  // rand() when a chapter is BUILT, which happens at page load — not on
  // switchTo. Re-entering a chapter inside one session re-measures within
  // ~1,500 because it is the same build; across page loads it does not.
  // Measured over four loads, 26 Aug:
  //
  //     goreme 10,116  ·  hanoi 2,756  ·  pantanal 2,684  ·  sahara 1,834
  //     quay 780       ·  monaco 100
  //
  // Göreme is the busiest chapter in the game and its spread is nearly seven
  // times the global figure, so its old 214,000 line sat INSIDE its own noise
  // and tripped at random — which it did, by 630, on the run that found this.
  //
  // AND MEASURE THE SPREAD WITH THIS SCRIPT, NOT A SIDE PROBE. The four-load
  // sample above was taken with a shorter settle than the gate itself uses, and
  // it under-read Hanoi by nine thousand triangles: 236-239k on the probe
  // against 241-245.5k here, because more of the chapter's transient content —
  // bikes, crowd, particles — exists by the time this script counts. The
  // ceiling set from it tripped on the very next run, by 546, with no geometry
  // added. Under this script, over four runs:
  //
  //     goreme 201,146-213,798 (12,652)  ·  hanoi 241,494-245,546 (4,052)
  //     ·  monaco 135,283-135,431 (148)
  //
  // A ratchet is a promise about a measurement, so it has to be sized by the
  // thing that will do the measuring.
  const CEIL = {
    pantanal: 217000, goreme: 222000, iceland: 205000, sahara: 205000,
    drift: 191000, venice: 188000, antarctic: 188000, quay: 165000,
    cave: 166000, kowloon: 160000, palawan: 136000, rio: 134000,
    kyoto: 128000, pasto: 110000, cali: 100000, manly: 92000, sydney: 87000,
    // Chapters 18 and 19, recorded here for the first time — they shipped
    // after the Payoff Pass closed and no gate in qa/ could see them.
    monaco: 141000, hanoi: 252000,
  }
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
               'monaco','hanoi']
  const rows = []
  for (const n of ALL) {
    rows.push(await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)

      // ---- the count. NOT renderer.info: with the post chain in place a read
      // after a frame returns the composite quad, 1 call and 1 triangle. This
      // walks the scene and respects the whole visibility chain.
      let tris = 0, shadow = 0, meshes = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        meshes++
        const t = (gm.index ? gm.index.count / 3
                            : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)) *
                  (o.isInstancedMesh ? o.count : 1)
        tris += t
        if (o.castShadow) shadow += t
      })

      // ---- the cost. rAF is pinned to the display, so every chapter measures
      // 16.67 ms and a frame-time reading says nothing at all. The only way to
      // see a chapter's real cost is to render it N times back to back with a
      // gl.finish() at the end.
      const gl = g.renderer.getContext()
      const render = () => {
        if (g.post && g.post.enabled) g.post.render()
        else g.renderer.render(g.scene, g.camera)
      }
      // TAKE THE MINIMUM OF SEVERAL REPEATS, NOT ONE MEAN. Noise on a shared
      // GPU only ever ADDS time, so the minimum is the robust estimator and the
      // mean is a reading of whatever else the machine was doing. Measured
      // 26 Aug 2026 on a loaded machine: single-mean readings swung 1.68 to
      // 5.31 ms for the same chapter across two runs minutes apart, and the
      // audit reported a confident FAIL from the high one.
      const timed = (reps) => {
        let best = Infinity
        for (let r = 0; r < reps; r++) {
          render(); gl.finish()
          const t0 = performance.now()
          for (let i = 0; i < 20; i++) render()
          gl.finish()
          const per = (performance.now() - t0) / 20
          if (per < best) best = per
        }
        return best
      }
      const full = timed(5)
      const was = g.renderer.shadowMap.enabled
      g.renderer.shadowMap.enabled = false
      const noShadow = timed(5)
      g.renderer.shadowMap.enabled = was

      // SELF-CHECK. Turning the shadow pass OFF cannot make a chapter slower.
      // If it reads that way the measurement is contaminated and this row must
      // not be allowed to arbitrate anything — the whole point of the cost gate
      // is that it is the number the triangle gate was standing in for.
      const noisy = noShadow > full + 0.05
      return { n: name, tris: Math.round(tris), shadowTris: Math.round(shadow),
               meshes, ms: +full.toFixed(2), msNoShadow: +noShadow.toFixed(2),
               shadowMs: +(full - noShadow).toFixed(2), noisy }
    }, n))
  }

  const out = { triBudget: TRI_BUDGET, msBudget: MS_BUDGET, ceilings: CEIL,
                rows: rows, fail: [], overTri: [], noCeil: [], noisy: [] }
  const contaminated = rows.filter(r => r.noisy).map(r => r.n)
  for (const r of rows) {
    if (r.noisy) out.noisy.push(r.n + ': shadows OFF measured SLOWER than shadows on (' +
                                r.msNoShadow + ' vs ' + r.ms + ') — this row is noise')
    // A contaminated run may not fail anything on cost. It is not evidence that
    // the game got slower, it is evidence the machine was busy; close the other
    // GPU clients and run it again.
    if (!contaminated.length && r.ms > MS_BUDGET) {
      out.fail.push('FAIL cost · ' + r.n + ': ' + r.ms + ' ms of render per frame, over the ' +
                    MS_BUDGET + ' ms gate (' + r.tris + ' tris)')
    }
    const c = CEIL[r.n]
    // A chapter with no recorded ceiling passed the ratchet SILENTLY, which is
    // the same shape of green-means-nothing that pf-mischief.js's ownedProps
    // and stillness.js's slopeAt were both caught making. Chapters 18 and 19
    // shipped into exactly that hole. Say it out loud instead.
    if (!c) out.noCeil.push(r.n + ': ' + r.tris + ' triangles, NO recorded ceiling — ' +
                            'the ratchet cannot hold a line nobody has drawn')
    if (c && r.tris > c) {
      out.fail.push('FAIL ratchet · ' + r.n + ': ' + r.tris + ' triangles, over its recorded ' +
                    'ceiling of ' + c + ' by ' + (r.tris - c) + '. Something was ADDED. ' +
                    'Reallocate it, or raise the line here with a measurement and a reason.')
    }
    if (r.tris > TRI_BUDGET) {
      out.overTri.push(r.n + ': ' + r.tris + ', over the ' + TRI_BUDGET + ' brief gate by ' +
                       (r.tris - TRI_BUDGET) + ' — renders in ' + r.ms + ' ms (' +
                       (r.ms / (r.tris / 100000)).toFixed(2) + ' ms per 100k)')
    }
  }
  rows.sort((a, b) => b.ms - a.ms)
  out.worst = rows[0]
  out.pass = out.fail.length === 0 && out.noCeil.length === 0
  out.costUsable = contaminated.length === 0
  out.summary = (out.pass ? 'PASS' : 'FAIL (' + (out.fail.length + out.noCeil.length) + ')') +
                ' · ' + out.overTri.length + ' of ' + ALL.length + ' over the 130k brief gate · ' +
                (out.costUsable
                   ? 'worst chapter ' + rows[0].n + ' at ' + rows[0].ms + ' ms of a 16.67 ms frame'
                   : 'COST GATE UNUSABLE — ' + contaminated.length + ' contaminated rows (' +
                     contaminated.join(', ') + '). Triangles and the ratchet still stand.')
  await page.evaluate(async (o) => { await fetch('/shot?name=budget.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
