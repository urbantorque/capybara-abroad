async page => {
  const out = {}
  for (const n of ['hanoi', 'monaco']) {
    await page.evaluate((name) => window.__capy.hud.cross(name), n)
    await page.waitForTimeout(9000)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const s0 = g.state.solverSaves || 0
      const rows = []
      for (const b of g.world.bodies) {
        const v = b.velocity, p = b.position
        const sp = Math.hypot(v.x, v.y, v.z)
        if (sp > 60 || p.y < -100) {
          let pr = null
          for (const q of g.props) if (q.body === b) { pr = q; break }
          let npc = null
          for (const q of (g.locals || [])) if (q.body === b) { npc = q; break }
          rows.push({ pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], sp: +sp.toFixed(1), mass: b.mass, type: b.type, sleep: b.sleepState,
            shape: b.shapes[0] && b.shapes[0].type, cg: b.collisionFilterGroup, cm: b.collisionFilterMask,
            prop: pr ? { kind: pr.kind, biome: pr.biome, hidden: !!pr.hidden, removed: !!pr.removed, inWater: !!pr.inWater, held: !!pr.held, homeY: pr.homeY, hiddenUntil: pr.hiddenUntil, owner: !!pr.owner, keepsake: !!(pr.keep || pr.keepsake || pr.souvenir) } : null,
            npc: npc ? { role: npc.role, biome: npc.biome, state: npc.state } : null,
            isCapy: b === g.capy.body, keys: Object.keys(b).filter(k => !['position','velocity','force','torque','quaternion','previousPosition','interpolatedPosition','interpolatedQuaternion','initPosition','initVelocity','initQuaternion','initAngularVelocity','angularVelocity','previousQuaternion','shapes','shapeOffsets','shapeOrientations','aabb','world','invMassSolve','invInertiaSolve','invInertiaWorldSolve','invInertia','invInertiaWorld','inertia','vlambda','wlambda','_listeners','id','index','material','linearFactor','angularFactor','boundingRadius','wakeUpAfterNarrowphase','sleepState','timeLastSleepy','allowSleep','sleepSpeedLimit','sleepTimeLimit','aabbNeedsUpdate','isTrigger','collisionResponse','collisionFilterGroup','collisionFilterMask','mass','invMass','type','fixedRotation','linearDamping','angularDamping','updateSolveMassProperties'].includes(k)) })
        }
      }
      return { biome: g.biome.current, rows, bodies: g.world.bodies.length }
    }, n)
    await page.waitForTimeout(3000)
    out[n].savesIn3s = await page.evaluate(() => window.__capy.state.solverSaves)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-fall2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
