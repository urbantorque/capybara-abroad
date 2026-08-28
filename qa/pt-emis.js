async page => {
  const KEYS=[['Minus','kowloon'],['Period','monaco'],['Digit7','iceland'],['Digit1','sydney'],['Digit0','venice']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r=await page.evaluate((want)=>{
      const g=window.__capy;
      let n=0, inst=0, tot=0; const cols={};
      const V=new g.THREE.Vector3();
      const pts=[];
      g.scene.traverse(o=>{
        if(!o.isMesh||!o.visible) return; tot++;
        const m=o.material; if(!m||!m.emissive) return;
        const e=m.emissive, s=(m.emissiveIntensity===undefined?1:m.emissiveIntensity);
        const lum=(0.2126*e.r+0.7152*e.g+0.0722*e.b)*s;
        if(lum<0.02) return;
        n++; if(o.isInstancedMesh) inst++;
        const k=e.getHexString(); cols[k]=(cols[k]||0)+1;
        if(pts.length<400){ o.getWorldPosition(V);
          pts.push([+V.x.toFixed(1),+V.y.toFixed(1),+V.z.toFixed(1),+lum.toFixed(2),o.isInstancedMesh?o.count:1]); }
      });
      // how spread out are they
      let ys=pts.map(p=>p[1]).sort((a,b)=>a-b);
      return {want,biome:g.biome.current,meshes:tot,emissive:n,emissiveInstanced:inst,
              distinctColours:Object.keys(cols).length,
              yMed: ys.length?ys[Math.floor(ys.length/2)]:null,
              sample:pts.slice(0,6)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-emis.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
