async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit7'); await page.waitForTimeout(8000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const M4=new g.THREE.Matrix4(), V=new g.THREE.Vector3();
    const cand=[]; const missed={basic:0,noEmis:0,lowLum:0,lowY:0};
    g.scene.traverse(o=>{
      if(!o.isMesh||!o.visible) return;
      const m=o.material; if(!m) return;
      if(!m.emissive){ if(m.isMeshBasicMaterial) missed.basic++; else missed.noEmis++; return; }
      const ei=m.emissiveIntensity===undefined?1:m.emissiveIntensity;
      const lum=(0.2126*m.emissive.r+0.7152*m.emissive.g+0.0722*m.emissive.b)*ei;
      if(lum<0.10){ missed.lowLum++; return; }
      const push=(x,y,z)=>{ if(y<1.0){missed.lowY++;return;} cand.push([+x.toFixed(1),+y.toFixed(1),+z.toFixed(1),+lum.toFixed(2)]); };
      if(o.isInstancedMesh){ for(let i=0;i<o.count;i++){ o.getMatrixAt(i,M4); V.setFromMatrixPosition(M4); o.localToWorld(V); push(V.x,V.y,V.z);} }
      else { o.getWorldPosition(V); push(V.x,V.y,V.z); }
    });
    const cp=g.capy.position;
    const withD=cand.map(c=>({p:c, d:+Math.hypot(c[0]-cp.x,c[1]-cp.y,c[2]-cp.z).toFixed(1)}))
                    .sort((a,b)=>a.d-b.d);
    return {biome:g.biome.current, capy:[+cp.x.toFixed(1),+cp.y.toFixed(1),+cp.z.toFixed(1)],
            candidates:cand.length, missed, nearest:withD.slice(0,10)};
  });
  await page.evaluate((o)=>fetch('/shot?name=pt-hk.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),r);
}
