// PAYOFF batch 1, job 2: THE MISCHIEF ECONOMY, measured.
//
// Four things, per chapter:
//   OWNERSHIP  how many props have an owner at all — this is the adoption
//              number, and the brief asks for at least two per chapter.
//   THE WALK   rob one and does somebody actually set off, get there, and
//              put it back?
//   THE CEILING  a retrieval that can never succeed (the prop parked past the
//              leash, or the animal stood on it) must still END. This is the
//              catch-all-state rule and it is the only assertion here that
//              would have caught the waiter.
//   CHAINS     one reaction line turns a second head.
async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)

  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                 'cave', 'antarctic']
  const out = { chapters: {}, issues: [] }
  for (const n of names) {
    out.chapters[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const L = g.locals.filter(r => r.biome === live)
      const walkers = L.filter(r => r.fig)
      // ---- THE THREE CHAINS, per chapter -----------------------------------
      // A  OWNERSHIP     a prop under 12 kg, not a souvenir, whose HOME is
      //                  within npcOWN_R (11 m) of somebody who can walk. Take
      //                  it or knock it over and they come and get it.
      // B  PRODUCE       an edible prop and anybody at all to eat it in front
      //                  of. This one is player-placed — you carry the food to
      //                  the person — so it needs no proximity at spawn.
      // C  WITNESS       two people within npcCHAIN_R (20 m) of each other, so
      //                  a reaction line turns a second head.
      //
      // Sydney and Pasto are populated by the STEERING cast (game.npcs) and
      // not by locals at all: their ownership is stronger (a prop carries
      // `owner`, and taking it starts a chase) and their produce reaction is
      // the startle+shoo added alongside it, so they are counted separately.
      const OWN_R = 11, CHAIN_R = 20
      const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
        (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
      const pairs = []
      const owners = new Set()
      for (const p of props) {
        let best = null, bd = OWN_R * OWN_R
        for (const r of walkers) {
          const dx = p.homeX - r.ax, dz = p.homeZ - r.az
          const d2 = dx * dx + dz * dz
          if (d2 < bd) { bd = d2; best = r }
        }
        if (best) { pairs.push({ type: p.type, d: +Math.sqrt(bd).toFixed(1) }); owners.add(best) }
      }
      let edible = 0
      for (const p of props) {
        const def = g.physics && g.physics.typeOf ? g.physics.typeOf(p.type) : null
        if (def ? def.edible : /sandwich|empanada|fruit|orange|bread|bun|cake|dumpling|pastry|fish|mango|banana|date|churro|lulada|matcha|tea|corn|biscoito|gelato|icecream|chip|hotdog|pylsa|bowl|krill|ration/i.test(p.type)) edible++
      }
      let pairsNear = 0
      for (let i = 0; i < L.length; i++) {
        for (let j = i + 1; j < L.length; j++) {
          const dx = L[i].x - L[j].x, dz = L[i].z - L[j].z
          if (dx * dx + dz * dz < CHAIN_R * CHAIN_R) pairsNear++
        }
      }
      const A = owners.size >= 1, B = edible >= 1 && L.length >= 1, C = pairsNear >= 1
      // nProps IS NOT COSMETIC. Without it, "0 owned props" and "this chapter's
      // props had not been scattered when I looked" are the same number, and on
      // 25 Aug 2026 they were: Kyoto read 0/0 here and 3 owners at 3.8 m when
      // measured on its own. An adoption count with no population count behind
      // it cannot tell adoption from an empty room.
      return { locals: L.length, walkers: walkers.length, nProps: props.length,
               ownedProps: pairs.length,
               owners: owners.size, edible, pairsNear,
               chains: (A ? 1 : 0) + (B ? 1 : 0) + (C ? 1 : 0),
               A, B, C, sample: pairs.slice(0, 5) }
    }, n)
  }

  // ---- THE WALK, and THE CEILING, in one chapter that has both -------------
  const drill = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const R = {}
    // pick the chapter with the most owned props
    const tryIn = async (name) => {
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const walkers = g.locals.filter(r => r.biome === live && r.fig)
      let pick = null, owner = null, bd = 1e9
      for (const p of g.props) {
        if (p.removed || p.hidden || p.keep || p.held) continue
        if (p.biome && p.biome !== live) continue
        if (!(p.mass > 0) || p.mass > 12) continue
        for (const r of walkers) {
          const dx = p.homeX - r.ax, dz = p.homeZ - r.az
          const d2 = dx * dx + dz * dz
          if (d2 < 11 * 11 && d2 < bd) { bd = d2; pick = p; owner = r }
        }
      }
      return { live, pick, owner }
    }
    let sel = await tryIn('sahara')
    if (!sel.pick) sel = await tryIn('venice')
    if (!sel.pick) sel = await tryIn('kyoto')
    if (!sel.pick) { R.note = 'no owned prop found in sahara/venice/kyoto'; return R }
    const { pick, owner } = sel
    R.chapter = sel.live
    R.prop = pick.type
    R.ownerAt = [+owner.ax.toFixed(1), +owner.az.toFixed(1)]
    R.propHome = [+pick.homeX.toFixed(1), +pick.homeZ.toFixed(1)]

    // ---- 1. THE WALK. Move the prop 5 m away and emit the theft. -----------
    const hx = pick.homeX, hz = pick.homeZ
    pick.body.wakeUp()
    pick.body.position.set(hx + 5, pick.body.position.y, hz)
    pick.body.velocity.set(0, 0, 0)
    g.events.emit('capy:grab', { prop: pick, from: null })
    for (let i = 0; i < 6; i++) g.tick(1 / 60, false)
    R.started = !!owner.own
    let maxOut = 0, frames = 0
    for (let i = 0; i < 60 * 25 && owner.own; i++) {
      maxOut = Math.max(maxOut, Math.hypot(owner.x - owner.ax, owner.z - owner.az))
      g.tick(1 / 60, false); frames++
    }
    R.walkFrames = frames
    R.walkSeconds = +(frames / 60).toFixed(1)
    R.maxOut = +maxOut.toFixed(2)
    R.homeAgain = +Math.hypot(pick.body.position.x - hx, pick.body.position.z - hz).toFixed(2)
    // and they must get back on their spot
    for (let i = 0; i < 60 * 40; i++) {
      g.tick(1 / 60, false)
      if (Math.hypot(owner.x - owner.ax, owner.z - owner.az) < 0.6) break
    }
    R.backHome = +Math.hypot(owner.x - owner.ax, owner.z - owner.az).toFixed(2)
    R.backY = +Math.abs(owner.y - owner.baseY).toFixed(3)

    // ---- 2. THE CEILING. A retrieval that can never succeed. ---------------
    // A MOVING TARGET, not a parked one: the prop is pinned three metres beyond
    // the chaser every frame, always inside the leash, so the LEASH can never
    // end this and only the ceiling can. A steering state with no ceiling runs
    // for ever against a target like this — which is exactly what the waiter
    // did — so this is the assertion that would have caught him.
    for (const r of g.locals) { r.ownCool = 0; r.own = null }
    pick.body.wakeUp()
    pick.body.position.set(owner.ax + 4, pick.body.position.y, owner.az)
    pick.body.velocity.set(0, 0, 0)
    g.events.emit('capy:grab', { prop: pick, from: null })
    for (let i = 0; i < 4; i++) g.tick(1 / 60, false)
    const chaser = g.locals.find(r => r.own === pick) || owner
    R.ceilStarted = !!chaser.own
    R.chaserSame = chaser === owner
    let cf = 0, ceilOut = 0
    for (let i = 0; i < 60 * 90 && chaser.own; i++) {
      // three metres beyond them, along the line from their anchor, capped at
      // 12 m from the anchor so the 15 m leash is never what stops this
      let dx = chaser.x - chaser.ax, dz = chaser.z - chaser.az
      let dl = Math.hypot(dx, dz)
      if (dl < 0.01) { dx = 1; dz = 0; dl = 1 }
      const out = Math.min(dl + 3, 12)
      pick.body.wakeUp()
      pick.body.position.set(chaser.ax + dx / dl * out, pick.body.position.y, chaser.az + dz / dl * out)
      pick.body.velocity.set(0, 0, 0)
      g.tick(1 / 60, false); cf++
      ceilOut = Math.max(ceilOut, Math.hypot(chaser.x - chaser.ax, chaser.z - chaser.az))
    }
    R.ceilFrames = cf
    R.ceilSeconds = +(cf / 60).toFixed(1)
    R.ceilMaxOut = +ceilOut.toFixed(2)
    R.ceilEnded = !chaser.own
    await sleep(30)
    return R
  })
  out.drill = drill

  // ---- CHAINS -------------------------------------------------------------
  out.chain = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)
    for (const r of L) { r.cd = 0; r.chatT = 0 }
    // stand next to somebody and set a crate off at their feet
    const a = L[0]
    b.position.set(a.x + 1.5, b.position.y, a.z)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
    // Cleared HERE and not before the settle ticks: chatStep fires on its own
    // and puts two people on cooldown, and localsReact only speaks through a
    // free mouth — so a cd cleared twenty frames ago is a cd that is not clear.
    for (const r of L) { r.cd = 0; r.chatT = 0 }
    const before = L.map(r => r.chatT)
    g.events.emit('prop:impact', { prop: null, speed: 9,
      position: new g.THREE.Vector3(a.x, a.y + 0.4, a.z) })
    for (let i = 0; i < 8; i++) g.tick(1 / 60, false)
    const looked = L.filter((r, i) => r.chatT > before[i] + 0.5).length
    const maxChat = Math.max.apply(null, L.map(r => r.chatT))
    const spoke = L.filter(r => r.cd > 0).length
    return { cast: L.length, looked, spoke, maxChat: +maxChat.toFixed(2) }
  })

  if (out.drill.started === false) out.issues.push('the walk never started')
  if (out.drill.homeAgain > 0.6) out.issues.push('the prop was not put back: ' + out.drill.homeAgain + ' m from home')
  if (out.drill.backHome > 0.6) out.issues.push('the owner never got back to their anchor: ' + out.drill.backHome + ' m')
  if (out.drill.backY > 0.05) out.issues.push('the owner came home at the wrong height: dy ' + out.drill.backY)
  if (!out.drill.ceilStarted) out.issues.push('the ceiling drill never started — nobody claimed the prop')
  if (!out.drill.ceilEnded) out.issues.push('NO CEILING: an unreachable retrieval ran ' + out.drill.ceilSeconds + ' s and was still running')
  if (out.chain.looked < 1) out.issues.push('no chain: nobody turned to look at the person who spoke')
  for (const k in out.chapters) {
    const c = out.chapters[k]
    if (k === 'sydney' || k === 'pasto') continue   // the steering cast; counted by hand
    if (c.chains < 2) out.issues.push('ADOPTION: ' + k + ' has only ' + c.chains +
      ' of the three chains (own=' + c.A + ' produce=' + c.B + ' witness=' + c.C +
      '; owners ' + c.owners + ', edible ' + c.edible + ', near pairs ' + c.pairsNear + ')')
  }
  out.errs = errs.slice(0, 20)
  await page.evaluate(async o => {
    await fetch('/shot?name=pfmischief.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
