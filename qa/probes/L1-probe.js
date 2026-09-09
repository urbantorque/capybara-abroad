async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['drift','iceland','quay','goreme','sahara']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name); await sleep(1400)
      const rows = []
      const root = g.scene.getObjectByName(name)
      const walk = (o, path) => {
        for (const c of o.children) {
          const nm = c.name || (c.isInstancedMesh ? 'inst' : c.isMesh ? 'mesh' : 'grp')
          if (c.isMesh || c.isInstancedMesh) {
            const gm = c.geometry
            const t = gm.index ? gm.index.count/3 : (gm.attributes.position? gm.attributes.position.count/3:0)
            const cnt = c.isInstancedMesh ? c.count : 1
            const m = Array.isArray(c.material)?c.material[0]:c.material
            rows.push({p: path+'/'+nm, tris: Math.round(t*cnt), cnt, per: Math.round(t),
              cast: !!c.castShadow, recv: !!c.receiveShadow, vis: c.visible,
              mt: m ? (m.type||'') : '', vc: m? !!m.vertexColors:false,
              tr: m? !!m.transparent:false, col: m&&m.color?'#'+m.color.getHexString():''})
          }
          if (c.children && c.children.length) walk(c, path+'/'+nm)
        }
      }
      if (root) walk(root, '')
      rows.sort((a,b)=>b.tris-a.tris)
      return { total: rows.reduce((s,r)=>s+r.tris,0), castTot: rows.filter(r=>r.cast).reduce((s,r)=>s+r.tris,0), n: rows.length, rows }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=L1.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
