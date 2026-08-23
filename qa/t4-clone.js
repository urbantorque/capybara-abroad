async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    const a = new THREE.MeshLambertMaterial({ color: 0x808080 })
    a.onBeforeCompile = function (s) { s.__hit = 1 }
    a.customProgramCacheKey = function () { return 'zz' }
    const b = a.clone()
    const proto = THREE.Material.prototype
    return { hasOBC: Object.prototype.hasOwnProperty.call(b, 'onBeforeCompile'),
             sameOBC: b.onBeforeCompile === a.onBeforeCompile,
             protoOBC: b.onBeforeCompile === proto.onBeforeCompile,
             sameKey: b.customProgramCacheKey === a.customProgramCacheKey,
             rev: THREE.REVISION }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4clone.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
