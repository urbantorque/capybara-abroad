async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const names = ['drift', 'iceland', 'quay', 'goreme', 'sahara']
  const out = {}
  // material -> the biomes it is used in, so a per-frame write on a shared
  // mat() cache entry is visible as a material that belongs to two chapters
  const seen = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      g.biome.switchTo(name); await sleep(1500)
      const root = g.scene.getObjectByName(name)
      const black = [], nofog = [], noRecv = [], bigCast = [], flat = [], mats = []
      let tot = 0, cast = 0
      const walk = (o, path) => {
        for (const c of o.children) {
          const nm = c.name || (c.isInstancedMesh ? 'inst' : c.isMesh ? 'mesh' : 'grp')
          if (c.isMesh || c.isInstancedMesh) {
            const gm = c.geometry
            const m = Array.isArray(c.material) ? c.material[0] : c.material
            const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
            const cnt = c.isInstancedMesh ? c.count : 1
            tot += t * cnt
            if (c.castShadow) cast += t * cnt
            mats.push(m ? m.uuid : '')
            // TRAP 4: a geometry with no colour attribute in a vertexColors
            // material renders BLACK — three feeds the shader a missing
            // attribute and it reads as zero.
            if (m && m.vertexColors && !gm.attributes.color && !c.instanceColor) {
              black.push({ p: path + '/' + nm, tris: Math.round(t * cnt), cnt })
            }
            // TRAP 6: a fog:false plate is visible through a mountain
            if (m && m.fog === false && !(m.depthTest === false)) {
              nofog.push({ p: path + '/' + nm, tris: Math.round(t * cnt) })
            }
            // a big ground surface that does not RECEIVE is a surface nothing
            // can cast onto — the other half of the shadow budget
            if (t * cnt > 3000 && !c.receiveShadow) noRecv.push({ p: path + '/' + nm, tris: Math.round(t * cnt) })
            if (c.castShadow && t * cnt > 8000) bigCast.push({ p: path + '/' + nm, tris: Math.round(t * cnt) })
            if (m && m.flatShading === false && m.type === 'MeshLambertMaterial') {
              flat.push({ p: path + '/' + nm })
            }
          }
          if (c.children && c.children.length) walk(c, path + '/' + nm)
        }
      }
      if (root) walk(root, '')
      return { tris: Math.round(tot), cast: Math.round(cast), pct: +(100 * cast / Math.max(1, tot)).toFixed(0),
               black, nofog, noRecv, bigCast, smooth: flat, mats }
    }, n)
    for (const u of out[n].mats) { (seen[u] = seen[u] || []).push(n) }
    delete out[n].mats
  }
  out.__shared = Object.keys(seen).filter(u => new Set(seen[u]).size > 1)
    .map(u => ({ u: u.slice(0, 8), bios: [...new Set(seen[u])] })).slice(0, 40)
  await page.evaluate(async (o) => { await fetch('/shot?name=LH.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
