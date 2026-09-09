async page => {
  const ALL = ['sydney','pasto','kyoto','cali','rio','venice','kowloon','sahara','monaco','hanoi']
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const rows = []
  for (const name of ALL) {
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const D = 1 / 60
      const live = g.npcs.filter(r => r && r.group && (!r.biome || r.biome === n))
      const prev = live.map(r => ({ x: r.group.position.x, z: r.group.position.z, vx: 0, vz: 0 }))
      const acc = live.map(() => ({ maxA: 0, sumV: 0, moved: 0, mis: 0, mn: 0, jerk: 0 }))
      const N = 600                                   // 10 s
      for (let f = 0; f < N; f++) {
        g.tick(D, false)
        for (let i = 0; i < live.length; i++) {
          const p = live[i].group.position
          const q = prev[i], a = acc[i]
          const vx = (p.x - q.x) / D, vz = (p.z - q.z) / D
          const ax = (vx - q.vx) / D, az = (vz - q.vz) / D
          const am = Math.hypot(ax, az)
          if (f > 2 && am > a.maxA) a.maxA = am
          if (f > 2 && am > 40) a.jerk++
          const v = Math.hypot(vx, vz)
          a.sumV += v
          if (v > 0.25) {
            a.moved++
            // how far the model's facing is from the way it is actually going
            const heading = Math.atan2(vx, vz)
            const yaw = live[i].group.rotation.y
            let d = heading - yaw
            while (d > Math.PI) d -= 2 * Math.PI
            while (d < -Math.PI) d += 2 * Math.PI
            a.mis += Math.abs(d); a.mn++
          }
          q.x = p.x; q.z = p.z; q.vx = vx; q.vz = vz
        }
      }
      let movers = 0, jerkers = 0, slid = 0, sumMis = 0, misN = 0, maxA = 0
      for (const a of acc) {
        if (a.moved > N * 0.05) movers++
        if (a.jerk > 3) jerkers++
        if (a.mn > 0) {
          const m = a.mis / a.mn
          sumMis += m; misN++
          if (m > 0.6) slid++            // facing more than 34 deg off travel
        }
        if (a.maxA > maxA) maxA = a.maxA
      }
      return { biome: g.biome.current, npcs: live.length, movers: movers,
               jerkers: jerkers, slid: slid,
               meanMisDeg: misN ? +(57.3 * sumMis / misN).toFixed(1) : null,
               maxAccel: +maxA.toFixed(0) }
    }, name))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-npc.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
