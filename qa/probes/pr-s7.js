async page => {
  const KEYS=[['Digit6','rio'],['Digit8','sahara'],['Equal','palawan'],['Digit4','kyoto']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r=await page.evaluate((want)=>{
      const g=window.__capy;
      const rows=[];
      g.scene.traverse(o=>{
        if(!o.isInstancedMesh||!o.visible) return;
        const k=typeof o.material.customProgramCacheKey==='function'
                ? String(o.material.customProgramCacheKey()) : '';
        if(k.indexOf('sway')===0) rows.push({count:o.count, cast:!!o.castShadow, depth:!!o.customDepthMaterial});
      });
      const gu=g.weather?g.weather.gust():null;
      const mag=gu?Math.hypot(gu.x,gu.z):0;
      const t0=performance.now(); for(let k2=0;k2<120;k2++) g.tick(1/60,true);
      return {want, biome:g.biome.current, err:g.state.lastError?String(g.state.lastError):null,
              swayMeshes:rows, gustMag:+mag.toFixed(2), swayK:+Math.min(mag/3.5,1.4).toFixed(2),
              ms:+((performance.now()-t0)/120).toFixed(3)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-s7.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
