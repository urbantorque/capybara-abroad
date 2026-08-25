async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('pantanal') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const api = g.pantanal
    const o = {}
    // ---- locals actually placed, and the pair-chat / wow geometry ----------
    const L = []
    try {
      const seen = g.__locals || null
      void seen
    } catch (e) {}
    // npc.js keeps `locals` private; walk the scene for the local groups instead
    const bodies = g.world.bodies.filter(b => b.userData && b.userData.local)
    bodies.forEach(b => { const r = b.userData.local; if (r.biome === 'pantanal') L.push({ x: r.x, z: r.z, near: r.near, hasPraise: !!r.praise, onTask: r.onTask ? Object.keys(r.onTask) : [] }) })
    o.locals = L
    o.nLocals = L.length
    // pair-chat pairs within 13 m
    let pairs = 0
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
      if (Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z) <= 13) pairs++
    o.chatPairs = pairs
    // distance from the payout point to the nearest local
    const PX = -34, PZ = -81.2
    o.payoutNearest = L.length ? Math.min.apply(null, L.map(r => Math.hypot(PX - r.x, PZ - r.z))) : null
    // ---- surface ladder coverage ------------------------------------------
    const sp = api.surfacePitch
    const pts = {
      road: [0, 0], sandbar: null, mat: null, raft: null, campo: [-60, 20],
      fazendaYard: null, crossingBank: [-34, -84]
    }
    const sb = api.caiman ? api.caiman() : null
    if (sb) pts.sandbar = [sb.x, sb.z]
    const ms = api.matStart ? api.matStart() : null
    if (ms) pts.mat = [ms.x, ms.z]
    const bk = api.bank || null
    if (bk) pts.fazendaYard = [bk.x, bk.z]
    o.surface = {}
    for (const k of Object.keys(pts)) {
      const p = pts[k]
      if (!p) { o.surface[k] = null; continue }
      const h = api.terrainHeight(p[0], p[1])
      o.surface[k] = { pitch: sp ? sp(p[0], h, p[1]) : null, h: +h.toFixed(2) }
    }
    // real signature of the road: measure at a bridge
    o.apiKeys = Object.keys(api)
    // ---- mischief / props ownership ---------------------------------------
    const props = (g.props || []).filter(p => p.biome === 'pantanal')
    o.props = props.length
    o.owned = props.filter(p => p.owner || p.ownerId || p.own).length
    o.propSample = props.slice(0, 4).map(p => Object.keys(p).join(','))
    // ---- route density: 20 m cells down the main route --------------------
    // the route is the road south from the spawn, then the crossing
    const route = []
    for (let z = 62; z > -50; z -= 4) route.push([api.roadX ? api.roadX(z) : 0, z])
    for (let z = -50; z > -90; z -= 4) route.push([-34, z])
    o.routeLen = route.length
    return o
  })
  out.errs = errs
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-3.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
