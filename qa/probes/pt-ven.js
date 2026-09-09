async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit0'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const v=g.venice;
    const out={api:v?Object.keys(v).slice(0,20):null};
    // sample the ground mesh's own vertex colours near known points
    let gm=null;
    g.scene.traverse(o=>{ if(o.isMesh && o.geometry && o.geometry.attributes.color
        && o.geometry.attributes.position.count>4000 && !o.isInstancedMesh) gm=gm||o; });
    if(!gm) return Object.assign(out,{err:'no ground'});
    const P=gm.geometry.attributes.position, C=gm.geometry.attributes.color;
    out.verts=P.count;
    function near(tx,tz){
      let bi=-1,bd=1e9;
      for(let i=0;i<P.count;i++){
        const dx=P.getX(i)-tx, dz=P.getZ(i)-tz, d=dx*dx+dz*dz;
        if(d<bd){bd=d;bi=i;}
      }
      return {at:[tx,tz], y:+P.getY(bi).toFixed(2), d:+Math.sqrt(bd).toFixed(2),
              rgb:[Math.round(C.getX(bi)*255),Math.round(C.getY(bi)*255),Math.round(C.getZ(bi)*255)]};
    }
    out.piazza    = near(-4,-30);   // middle of the Piazza (ribs read here)
    out.piazzetta = near(-4,  0);   // middle of the Piazzetta (blank in the shot)
    out.pzEdge    = near(-4,-16);
    out.ptSouth   = near(-4,  6);
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pt-ven.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
