async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Equal'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const out={biome:g.biome.current, err:g.state.lastError?String(g.state.lastError):null};
    const wx=g.weather; const gu=wx?wx.gust():null;
    out.gust = gu? {x:+gu.x.toFixed(2), z:+gu.z.toFixed(2), mag:+Math.hypot(gu.x,gu.z).toFixed(2)} : null;
    // find the frond mesh and read one instance's world-space vertex over time
    let fr=null;
    g.scene.traverse(o=>{ if(o.isInstancedMesh && o.geometry && o.geometry.attributes.position
                          && o.geometry.attributes.position.count===12 && o.visible) fr=fr||o; });
    out.found = !!fr;
    if(fr){ out.count=fr.count; out.hasDepth=!!fr.customDepthMaterial;
            out.progKey = typeof fr.material.customProgramCacheKey==='function'
                          ? fr.material.customProgramCacheKey().slice(0,50) : null; }
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-s1.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
