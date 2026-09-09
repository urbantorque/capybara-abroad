async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Equal'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const rows=[];
    g.scene.traverse(o=>{
      if(!o.isInstancedMesh || !o.visible) return;
      const k = typeof o.material.customProgramCacheKey==='function'
                ? String(o.material.customProgramCacheKey()) : '';
      rows.push({count:o.count, verts:o.geometry.attributes.position.count,
                 sway:k.indexOf('sway')===0, depth:!!o.customDepthMaterial,
                 cast:!!o.castShadow, key:k.slice(0,24)});
    });
    rows.sort((a,b)=>b.count-a.count);
    return {biome:g.biome.current, err:g.state.lastError?String(g.state.lastError):null,
            n:rows.length, top:rows.slice(0,8)};
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-s2.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
